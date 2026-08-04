<template>
  <div v-if="showBanner" class="e2ee-banner" role="status">
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
import { useI18n } from 'vue-i18n'
import { useEncryption } from '@/composables/encryption/useEncryption'

const { t } = useI18n()

const props = defineProps<{
  roomId: string
}>()

const { isRoomEncrypted } = useEncryption()

const isEncrypted = ref(false)
const dismissed = ref(false)

const STORAGE_KEY = computed(() => `tjg-e2ee-banner-dismissed-${props.roomId}`)

const showBanner = computed(() => isEncrypted.value && !dismissed.value)

function dismiss() {
  dismissed.value = true
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY.value, '1')
  }
}

onMounted(async () => {
  if (typeof localStorage !== 'undefined') {
    dismissed.value = localStorage.getItem(STORAGE_KEY.value) === '1'
  }
  if (props.roomId) {
    isEncrypted.value = await isRoomEncrypted(props.roomId)
  }
})

watch(
  () => props.roomId,
  async (newId) => {
    if (!newId) {
      isEncrypted.value = false
      return
    }
    if (typeof localStorage !== 'undefined') {
      dismissed.value = localStorage.getItem(`tjg-e2ee-banner-dismissed-${newId}`) === '1'
    }
    isEncrypted.value = await isRoomEncrypted(newId)
  }
)
</script>

<style scoped>
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
