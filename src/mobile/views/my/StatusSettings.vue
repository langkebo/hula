<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_status.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">{{ t('mobile_status.subtitle') }}</div>

          <div
            v-if="statusLoadFailed"
            data-test="status-load-error"
            class="flex items-center justify-between gap-12px rounded-8px px-12px py-8px border border-[--tjg-border-default]">
            <span class="text-12px text-[--tjg-text-secondary]">{{ t('mobile_status.load_failed') }}</span>
            <van-button size="small" plain type="primary" data-test="status-load-retry" @click="loadCurrentStatus">
              {{ t('common.retry') }}
            </van-button>
          </div>

          <van-cell-group inset>
            <van-cell
              v-for="status in statusOptions"
              :key="status.id"
              :title="status.label"
              is-link
              @click="handleStatusChange(status.id)">
              <template #icon>
                <div
                  class="w-24px h-24px rounded-full mr-12px flex items-center justify-center"
                  :style="{ backgroundColor: status.color }">
                  <Icon :icon="status.icon" :width="14" color="var(--tjg-text-inverse)" />
                </div>
              </template>
              <template #right-icon>
                <van-icon v-if="currentStatusId === status.id" name="success" color="var(--tjg-color-info-500)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-12px text-[var(--tjg-text-tertiary)] px-4px">
            {{ t('mobile_status.away_busy_limited') }}
          </div>

          <div class="mt-16px">
            <van-cell-group inset>
              <van-field
                v-model="statusMessage"
                :label="t('mobile_status.status_message')"
                :placeholder="t('mobile_status.status_message_placeholder')"
                autosize
                type="textarea"
                rows="1"
                show-word-limit
                maxlength="100" />
            </van-cell-group>
          </div>

          <div class="text-12px text-[--tjg-text-tertiary] px-4px">{{ t('mobile_status.expiry_hint') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_status.expiry_label')"
              :value="expiryLabel"
              is-link
              @click="showExpiryPicker = true" />
          </van-cell-group>

          <div class="mt-16px px-16px flex gap-12px">
            <van-button class="flex-1" block :disabled="loading || statusLoadFailed" @click="handleClearStatus">
              {{ t('mobile_status.clear_status') }}
            </van-button>
            <van-button
              class="flex-1"
              type="primary"
              block
              :loading="loading"
              :disabled="statusLoadFailed"
              @click="handleSave">
              {{ t('mobile_status.save') }}
            </van-button>
          </div>
        </div>
      </div>

      <van-popup v-model:show="showExpiryPicker" position="bottom" round>
        <van-picker :columns="expiryColumns" @confirm="handleExpiryConfirm" @cancel="showExpiryPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { OnlineEnum } from '@/enums'
import { matrixPresenceService, type PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { createLogger } from '@/utils/Logger'
import { isBusyUserStateTitle } from '@/utils/userStatus'

const logger = createLogger('StatusSettings')

const { t } = useI18n()
const router = useRouter()
const userStatusStore = useUserStatusStore()

const currentStatusId = ref(userStatusStore.stateId || 'online')
const statusMessage = ref('')
/** 进入页面时的服务端状态文案：保存时据此判断用户是否真的改过文案 */
const initialStatusMessage = ref('')
const loading = ref(false)
/** 回填失败不能落成默认状态：默认值一旦被保存就会覆盖服务端真实 presence */
const statusLoadFailed = ref(false)
const showExpiryPicker = ref(false)

/** 状态有效期档位（秒）；0 表示永久。Matrix 无服务端有效期，由本机计时清除（Y-12） */
const EXPIRY_OPTIONS = [
  { value: 0, key: 'never' },
  { value: 1800, key: '30m' },
  { value: 3600, key: '1h' },
  { value: 14400, key: '4h' },
  { value: 28800, key: '8h' },
  { value: 86400, key: '24h' }
] as const

const expirySeconds = ref(0)
const expiryColumns = computed(() =>
  EXPIRY_OPTIONS.map((option) => ({ text: t(`mobile_status.expiry.${option.key}`), value: option.value }))
)
const expiryLabel = computed(
  () => expiryColumns.value.find((column) => column.value === expirySeconds.value)?.text ?? expiryColumns.value[0].text
)

let expiryTimer: ReturnType<typeof setTimeout> | null = null

function clearExpiryTimer() {
  if (expiryTimer !== null) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

/** 到期后只清空状态文案并保留当前 presence，同时重置本地有效期与输入（Y-12） */
async function clearExpiredStatus() {
  try {
    await matrixPresenceService.setPresence(resolveTargetPresence(), '')
  } catch (error) {
    logger.warn('Failed to clear expired status message', error)
    return
  }
  userStatusStore.presenceExpiresAt = null
  initialStatusMessage.value = ''
  statusMessage.value = ''
  expirySeconds.value = 0
}

function scheduleExpiry(deadline: number) {
  clearExpiryTimer()
  const delay = deadline - Date.now()
  if (delay <= 0) {
    void clearExpiredStatus()
    return
  }
  expiryTimer = setTimeout(() => {
    expiryTimer = null
    void clearExpiredStatus()
  }, delay)
}

const statusOptions = [
  { id: 'online', label: t('mobile_status.status.online'), icon: 'mdi:circle', color: 'var(--tjg-color-success-500)' },
  { id: 'away', label: t('mobile_status.status.away'), icon: 'mdi:circle', color: 'var(--tjg-color-warning-500)' },
  { id: 'busy', label: t('mobile_status.status.busy'), icon: 'mdi:circle', color: 'var(--tjg-color-danger-500)' },
  {
    id: 'offline',
    label: t('mobile_status.status.offline'),
    icon: 'mdi:circle-outline',
    color: 'var(--tjg-text-quaternary)'
  }
]

function handleStatusChange(statusId: string) {
  currentStatusId.value = statusId
}

function handleExpiryConfirm({ selectedValues }: { selectedValues: number[] }) {
  expirySeconds.value = selectedValues[0] ?? 0
  showExpiryPicker.value = false
}

function resolveTargetPresence(): 'online' | 'offline' | 'unavailable' {
  const presenceMap: Record<string, 'online' | 'offline' | 'unavailable'> = {
    online: 'online',
    away: 'unavailable',
    busy: 'unavailable',
    offline: 'offline'
  }
  return presenceMap[currentStatusId.value] || 'online'
}

/**
 * presence → 页面状态。
 *
 * Matrix 协议只有 online/offline/unavailable 三态，away 与 busy 都上报为 unavailable，
 * 因此 unavailable 时沿用本地已保存状态标题的语义（可判定为忙碌则选 busy），其余按离开处理。
 */
function resolveStatusId(presence: PresenceState): string {
  if (presence === 'online') return 'online'
  if (presence === 'offline') return 'offline'
  const storedTitle = userStatusStore.currentState?.title
  if (storedTitle && isBusyUserStateTitle(storedTitle)) return 'busy'
  return currentStatusId.value === 'busy' ? 'busy' : 'away'
}

/** 进入页面回填服务端真实 presence 与状态文案，避免把「页面初值」当成用户输入 */
async function loadCurrentStatus(): Promise<void> {
  statusLoadFailed.value = false
  try {
    const info = await matrixPresenceService.getCurrentPresence()
    initialStatusMessage.value = info.status_msg ?? ''
    statusMessage.value = initialStatusMessage.value
    currentStatusId.value = resolveStatusId(info.presence)
  } catch (error) {
    // 回填失败时保持空文案并禁止写回：默认状态会覆盖服务端真实 presence
    logger.warn('Failed to load current presence', error)
    statusLoadFailed.value = true
  }
}

onMounted(async () => {
  await loadCurrentStatus()

  const deadline = userStatusStore.presenceExpiresAt
  if (deadline === null) return

  if (deadline <= Date.now()) {
    await clearExpiredStatus()
    return
  }

  // 恢复上次选择的有效期档位，避免重启后显示成「永久」却仍会到期
  const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000)
  expirySeconds.value = EXPIRY_OPTIONS.find((option) => option.value >= remainingSeconds)?.value ?? 0
  scheduleExpiry(deadline)
})

onUnmounted(clearExpiryTimer)

async function handleSave() {
  // 错误期间禁止写回：未回填成功时保存会把默认 presence 覆盖到服务端
  if (statusLoadFailed.value) return
  loading.value = true
  try {
    const targetPresence = resolveTargetPresence()
    // 只在用户真的改过文案时覆盖；未改动传 undefined，服务层会省略 status_msg 而不是清空
    const messageChanged = statusMessage.value !== initialStatusMessage.value
    // 与桌面同一唯一写入点：门控与记账都在 matrixPresenceService.setPresence 内完成，
    // 这里只传意图，并用返回的生效值把本地 activeStatus 同步为离线（hidesOnline 同语义）。
    const effective = await matrixPresenceService.setPresence(
      targetPresence,
      messageChanged ? statusMessage.value : undefined
    )
    const hidesOnline = effective !== targetPresence

    userStatusStore.stateId = currentStatusId.value
    // 有效期只在本机计时：Matrix 协议没有状态过期字段，到期后由本页清除文案（Y-12）
    const deadline = expirySeconds.value > 0 ? Date.now() + expirySeconds.value * 1000 : null
    userStatusStore.presenceExpiresAt = deadline
    if (deadline === null) {
      clearExpiryTimer()
    } else {
      scheduleExpiry(deadline)
    }

    const userStore = useUserStore()
    if (hidesOnline && userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.OFFLINE
    }

    showToast({
      type: 'success',
      message: t('mobile_status.save_success')
    })
    router.back()
  } catch (error) {
    logger.error('Failed to update status', error)
    showToast({
      type: 'fail',
      message: t('mobile_status.save_failed')
    })
  } finally {
    loading.value = false
  }
}

/** 清除状态文案与本地有效期；presence 保留为用户当前选择（Y-12） */
async function handleClearStatus() {
  // 错误期间禁止写回：未回填成功时清除会按默认 presence 上报
  if (statusLoadFailed.value) return
  loading.value = true
  try {
    // 服务层约定：传空串表示清空服务端状态文案，传 undefined 才是不改动
    await matrixPresenceService.setPresence(resolveTargetPresence(), '')
    clearExpiryTimer()
    userStatusStore.presenceExpiresAt = null
    initialStatusMessage.value = ''
    statusMessage.value = ''
    expirySeconds.value = 0
    showToast({
      type: 'success',
      message: t('mobile_status.clear_success')
    })
    router.back()
  } catch (error) {
    logger.error('Failed to clear status', error)
    showToast({
      type: 'fail',
      message: t('mobile_status.clear_failed')
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>
