<template>
  <!-- 未验证设备提示（R-1）：安全信号，优先于普通"已加密"提示 -->
  <div v-if="isEncrypted && noticeVisible" class="e2ee-notice" role="status" data-testid="e2ee-unverified-notice">
    <div class="e2ee-notice__content">
      <svg class="e2ee-notice__icon">
        <use href="#encrypted-lock"></use>
      </svg>
      <div class="e2ee-notice__text">
        <span class="e2ee-notice__title">{{ noticeTitle }}</span>
        <span class="e2ee-notice__desc">{{ noticeDesc }}</span>
      </div>
    </div>
    <div class="e2ee-notice__actions">
      <button
        v-if="status === 'failed'"
        type="button"
        class="e2ee-notice__action e2ee-notice__action--primary"
        data-testid="e2ee-notice-retry"
        @click="refresh">
        {{ t('e2ee.unverified.retry') }}
      </button>
      <template v-else-if="!strictActive">
        <button
          type="button"
          class="e2ee-notice__action e2ee-notice__action--primary"
          data-testid="e2ee-notice-enable-strict"
          @click="setRoomStrict(true)">
          {{ t('e2ee.unverified.action_strict') }}
        </button>
      </template>
      <button
        v-else-if="roomOverride === true"
        type="button"
        class="e2ee-notice__action"
        data-testid="e2ee-notice-revert-strict"
        @click="setRoomStrict(false)">
        {{ t('e2ee.unverified.action_revert') }}
      </button>
      <button
        type="button"
        class="e2ee-notice__close"
        :aria-label="t('common.close')"
        data-testid="e2ee-notice-dismiss"
        @click="dismissNotice">
        <svg class="e2ee-notice__close-icon">
          <use href="#close"></use>
        </svg>
      </button>
    </div>
  </div>

  <div v-else-if="isEncrypted && showBanner" class="e2ee-banner" role="status">
    <div class="e2ee-banner__content">
      <svg class="e2ee-banner__lock-icon">
        <use href="#encrypted-lock"></use>
      </svg>
      <div class="e2ee-banner__text">
        <span class="e2ee-banner__title">{{ t('e2ee.banner.title') }}</span>
        <span class="e2ee-banner__desc">{{ t('e2ee.banner.desc') }}</span>
      </div>
    </div>
    <button type="button" class="e2ee-banner__close" :aria-label="t('common.close')" @click="dismiss">
      <svg class="e2ee-banner__close-icon">
        <use href="#close"></use>
      </svg>
    </button>
  </div>
  <div v-else-if="isEncrypted" class="e2ee-indicator" :title="t('e2ee.banner.title')">
    <svg class="e2ee-indicator__icon">
      <use href="#encrypted-lock"></use>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEncryption } from '@/composables/encryption/useEncryption'
import { useRoomStrictness } from '@/composables/encryption/useRoomStrictness'

const { t } = useI18n()

const props = defineProps<{
  roomId: string
}>()

const { isRoomEncrypted } = useEncryption()
const { unverifiedCount, status, strictActive, roomOverride, setRoomStrict, refresh } = useRoomStrictness(
  () => props.roomId || null
)

const isEncrypted = ref(false)
const dismissed = ref(false)
/**
 * 未验证设备提示的关闭状态**只保留在本次会话内**：它是一条安全信号
 * （意味着有人收不到消息），一次点击不应永久静音，故不写盘。
 */
const noticeDismissed = ref(false)

const STORAGE_KEY = computed(() => `tjg-e2ee-banner-dismissed-${props.roomId}`)

const hasUnverified = computed(() => status.value === 'ready' && (unverifiedCount.value ?? 0) > 0)
const noticeVisible = computed(() => !noticeDismissed.value && (hasUnverified.value || status.value === 'failed'))
const showBanner = computed(() => !dismissed.value)

const noticeTitle = computed(() => {
  if (status.value === 'failed') return t('e2ee.unverified.query_failed_title')
  return t('e2ee.unverified.title', { count: unverifiedCount.value ?? 0 })
})

const noticeDesc = computed(() => {
  if (status.value === 'failed') return t('e2ee.unverified.query_failed_desc')
  if (strictActive.value) {
    return t('e2ee.unverified.strict_on_desc', { count: unverifiedCount.value ?? 0 })
  }
  return t('e2ee.unverified.desc')
})

function dismiss() {
  dismissed.value = true
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY.value, '1')
  }
}

function dismissNotice() {
  noticeDismissed.value = true
}

function readDismissed(roomId: string) {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(`tjg-e2ee-banner-dismissed-${roomId}`) === '1'
}

onMounted(async () => {
  dismissed.value = readDismissed(props.roomId)
  if (props.roomId) {
    isEncrypted.value = await isRoomEncrypted(props.roomId)
  }
})

watch(
  () => props.roomId,
  async (newId) => {
    // 换房间时重置会话级关闭状态，避免上一个房间的决定影响新房间
    noticeDismissed.value = false
    if (!newId) {
      isEncrypted.value = false
      return
    }
    dismissed.value = readDismissed(newId)
    isEncrypted.value = await isRoomEncrypted(newId)
  }
)
</script>

<style scoped>
.e2ee-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  margin: 0 12px 8px;
  border-radius: 10px;
  background: var(--tjg-color-warning-100, var(--tjg-color-primary-100));
  border: 1px solid var(--tjg-color-warning-300, var(--tjg-color-primary-200));
}

.e2ee-notice__content {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.e2ee-notice__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--tjg-color-warning-500, var(--tjg-color-primary-500));
}

.e2ee-notice__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.e2ee-notice__title {
  font-size: 13px;
  font-weight: 500;
}

.e2ee-notice__desc {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.e2ee-notice__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.e2ee-notice__action {
  padding: 2px 8px;
  border: 1px solid var(--tjg-color-primary-200);
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.e2ee-notice__action--primary {
  border-color: var(--tjg-color-primary-500);
  color: var(--tjg-color-primary-500);
}

.e2ee-notice__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
}

.e2ee-notice__close-icon {
  width: 12px;
  height: 12px;
}

.e2ee-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  margin: 0 12px 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--tjg-color-primary-100) 0%, var(--tjg-color-primary-50) 100%);
  border: 1px solid var(--tjg-color-primary-200);
}

.e2ee-banner__content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.e2ee-banner__lock-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.e2ee-banner__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.e2ee-banner__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--tjg-color-primary-500);
}

.e2ee-banner__desc {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.e2ee-banner__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
}

.e2ee-banner__close:hover {
  background: var(--tjg-color-primary-100);
  color: var(--tjg-text-primary);
}

.e2ee-banner__close-icon {
  width: 12px;
  height: 12px;
}

.e2ee-indicator {
  display: inline-flex;
  align-items: center;
  padding: 0 4px;
}

.e2ee-indicator__icon {
  width: 14px;
  height: 14px;
  color: var(--tjg-color-primary-500);
  opacity: 0.7;
}
</style>
