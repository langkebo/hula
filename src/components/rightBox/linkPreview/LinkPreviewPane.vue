<template>
  <n-drawer :show="show" :width="440" placement="right" @update:show="emit('update:show', $event)">
    <n-drawer-content :title="t('chat.link_preview.title')" closable>
      <div
        v-if="!settingStore.linkPreviewEnabled"
        class="text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-secondary]">
        {{ t('chat.link_preview.disabled') }}
      </div>

      <div v-else class="flex flex-col gap-12px">
        <n-input
          v-model:value="url"
          clearable
          data-test="link-preview-url"
          :placeholder="t('chat.link_preview.url_placeholder')"
          @blur="handleBlur"
          @keydown.enter.prevent="handleFetch" />

        <div class="flex items-center gap-8px min-h-22px">
          <n-button
            size="small"
            data-test="link-preview-fetch"
            :loading="fetching"
            :disabled="!isValidUrl"
            @click="handleFetch">
            {{ t('chat.link_preview.fetch') }}
          </n-button>
          <span v-if="statusText" class="text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-tertiary]">
            {{ statusText }}
          </span>
        </div>

        <div v-if="preview" class="link-preview-card" data-test="link-preview-card">
          <div v-if="thumbnailUrl" class="link-preview-card__thumb">
            <img :src="thumbnailUrl" :alt="preview.title" />
          </div>
          <div class="link-preview-card__meta">
            <div class="link-preview-card__title">{{ preview.title }}</div>
            <div v-if="preview.description" class="link-preview-card__desc">{{ preview.description }}</div>
            <div class="link-preview-card__host">{{ preview.siteName || host }}</div>
          </div>
        </div>

        <p v-else class="m-0 text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-quaternary]">
          {{ t('chat.link_preview.hint') }}
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-8px">
          <n-button tertiary @click="emit('update:show', false)">{{ t('common.cancel') }}</n-button>
          <n-button
            type="primary"
            data-test="link-preview-send"
            :disabled="!isValidUrl || !settingStore.linkPreviewEnabled"
            :loading="submitting"
            @click="handleSubmit">
            {{ t('chat.link_preview.send') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { THUMBNAIL_SIZE_LINK_PREVIEW } from '@/common/constants'
import type { RoomEncryptionState } from '@/services/matrix/crypto/cryptoAdapterTypes'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MediaUrlPreview } from '@/services/matrix/media/mediaTypes'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LinkPreviewPane')

const props = defineProps<{ show: boolean }>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [payload: MediaUrlPreview]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const globalStore = useGlobalStore()

const url = ref('')
const preview = ref<MediaUrlPreview | null>(null)
const fetching = ref(false)
const submitting = ref(false)
const fetchFailed = ref(false)
const blockedByEncryption = ref(false)

/** 同一 URL 的在途抓取复用同一 Promise，避免 blur + 发送 双发或丢结果。 */
let inflight: { target: string; promise: Promise<MediaUrlPreview | null> } | null = null
/** 请求代次：切房/reset 后递增，用于丢弃过期结果。 */
let requestSeq = 0

/** 补全协议并校验，非法时返回空串。 */
const normalizedUrl = computed(() => {
  const raw = url.value.trim()
  if (!raw) return ''
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(candidate)
    if (!parsed.hostname.includes('.')) return ''
    return parsed.toString()
  } catch {
    return ''
  }
})

const isValidUrl = computed(() => normalizedUrl.value !== '')

const host = computed(() => {
  try {
    return new URL(normalizedUrl.value).hostname
  } catch {
    return ''
  }
})

/** 渲染侧统一处理 mxc://，这里只做展示用的 HTTP 转换。 */
const thumbnailUrl = computed(() => {
  const imageUrl = preview.value?.imageUrl
  if (!imageUrl) return ''
  if (!imageUrl.startsWith('mxc://')) return imageUrl
  return matrixMediaService.getMediaUrl(imageUrl, THUMBNAIL_SIZE_LINK_PREVIEW, THUMBNAIL_SIZE_LINK_PREVIEW) || ''
})

const statusText = computed(() => {
  if (blockedByEncryption.value) return t('chat.link_preview.blocked_encrypted')
  if (fetching.value) return t('chat.link_preview.fetching')
  if (fetchFailed.value) return t('chat.link_preview.fetch_failed')
  return ''
})

/**
 * 解密只发生在客户端；链接一旦交给服务端抓取，房间的加密承诺就被绕开了。
 * 所有服务端抓取都必须先过这道闸门（含「获取预览」与「发送」两条路径）。
 *
 * 判定必须用三态并 fail-closed：只有明确 `plaintext` 才放行，`encrypted` 与
 * `unknown` 一并阻断。`unknown` 意味着拿不到房间加密状态（冷启动时房间可能
 * 尚未进入 client store、SDK 查询异常等），此时默认不放行——宁可短暂无法预览，
 * 也不把明文 URL 泄漏给服务端。
 *
 * roomId 为空同样按阻断处理：拿不到房间上下文就无法确认房间是明文，无法确认
 * 即不放行，不能因为「文案不好看」而退化成 fail-open。
 */
const ensurePreviewAllowed = async (seq: number): Promise<boolean> => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) {
    if (seq === requestSeq) {
      blockedByEncryption.value = true
      preview.value = null
      fetchFailed.value = false
    }
    return false
  }
  const state: RoomEncryptionState = await matrixCryptoService.getRoomEncryptionState(roomId)
  // 请求已被切房/reset 作废，不再改写当前会话的状态。
  if (seq !== requestSeq) return false
  if (state !== 'plaintext') {
    blockedByEncryption.value = true
    preview.value = null
    fetchFailed.value = false
    return false
  }
  blockedByEncryption.value = false
  return true
}

/**
 * 拉取预览；失败返回 null，由调用方决定降级策略。
 * 同一 URL 的在途请求复用同一 Promise，`blur` 自动抓取后立刻点「发送」不会丢结果；
 * 写回界面与复位 `fetching` 都受请求代次约束，切房后过期结果直接丢弃。
 */
const fetchPreview = (target: string): Promise<MediaUrlPreview | null> => {
  if (inflight?.target === target) return inflight.promise
  const seq = ++requestSeq
  const promise = (async (): Promise<MediaUrlPreview | null> => {
    fetching.value = true
    try {
      if (!(await ensurePreviewAllowed(seq))) return null
      const result = await matrixMediaService.getUrlPreview(target)
      if (seq === requestSeq) {
        preview.value = result
        fetchFailed.value = !result
      }
      return result
    } catch (err) {
      logger.warn(`[LinkPreview] failed to fetch preview: ${err}`)
      if (seq === requestSeq) {
        preview.value = null
        fetchFailed.value = true
      }
      return null
    } finally {
      if (seq === requestSeq) {
        fetching.value = false
        inflight = null
      }
    }
  })()
  inflight = { target, promise }
  return promise
}

const handleFetch = async () => {
  if (!isValidUrl.value) return
  await fetchPreview(normalizedUrl.value)
}

const handleBlur = () => {
  if (isValidUrl.value && !preview.value && !fetching.value) {
    void handleFetch()
  }
}

const reset = () => {
  requestSeq++
  inflight = null
  fetching.value = false
  url.value = ''
  preview.value = null
  fetchFailed.value = false
  blockedByEncryption.value = false
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) reset()
  }
)

/** 抽屉开着时切换会话，必须清掉上一房间的预览与「已加密禁用」提示。 */
watch(
  () => globalStore.currentSessionRoomId,
  () => reset()
)

const handleSubmit = async () => {
  if (!isValidUrl.value || submitting.value) return
  submitting.value = true
  try {
    const target = normalizedUrl.value
    const payload = preview.value ?? (await fetchPreview(target))
    emit('submit', payload ?? { url: target, title: target })
    emit('update:show', false)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.link-preview-card {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--tjg-border-default);
  border-radius: 8px;
  background: var(--tjg-surface-muted);

  &__thumb {
    width: 96px;
    flex-shrink: 0;
    background: var(--tjg-surface-app);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__meta {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 10px;
  }

  &__title {
    font-size: var(--tjg-font-size-base);
    font-weight: 500;
    color: var(--tjg-text-primary);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  &__desc {
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-text-secondary);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  &__host {
    margin-top: auto;
    font-size: var(--tjg-font-size-2xs);
    color: var(--tjg-text-quaternary);
  }
}
</style>
