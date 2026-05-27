<template>
  <n-card size="small" :bordered="true">
    <template #header>
      <n-flex align="center" :size="8">
        <Icon icon="mdi:shield-lock-outline" class="text-16px" />
        <span>{{ t('encryption.room_settings.title') }}</span>
      </n-flex>
    </template>

    <n-spin :show="loading" size="small">
      <template v-if="!isEncrypted">
        <n-flex vertical :size="12" align="center">
          <Icon icon="mdi:shield-off-outline" class="text-32px color-[--hula-text-tertiary]" />
          <span class="text-13px text-gray-500">{{ t('encryption.room_settings.not_encrypted') }}</span>
          <n-button type="primary" size="small" :loading="enabling" @click="handleEnableEncryption">
            <template #icon>
              <Icon icon="mdi:shield-lock" />
            </template>
            {{ t('encryption.room_settings.enable') }}
          </n-button>
        </n-flex>
      </template>

      <template v-else>
        <n-descriptions bordered :column="1" label-placement="left" size="small">
          <n-descriptions-item :label="t('encryption.room_settings.status')">
            <n-tag type="success" size="small" round>
              {{ t('encryption.room_settings.encrypted') }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item v-if="encryptionSettings?.algorithm" :label="t('encryption.room_settings.algorithm')">
            {{ encryptionSettings.algorithm }}
          </n-descriptions-item>
          <n-descriptions-item
            v-if="encryptionSettings?.rotationPeriodMs"
            :label="t('encryption.room_settings.rotation_period')">
            {{ formatDuration(encryptionSettings.rotationPeriodMs) }}
          </n-descriptions-item>
          <n-descriptions-item
            v-if="encryptionSettings?.rotationPeriodMsgs"
            :label="t('encryption.room_settings.rotation_period_msgs')">
            {{ encryptionSettings.rotationPeriodMsgs }}
          </n-descriptions-item>
        </n-descriptions>
      </template>
    </n-spin>
  </n-card>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

const loading = ref(false)
const enabling = ref(false)
const isEncrypted = ref(false)
const encryptionSettings = ref<{
  algorithm?: string
  rotationPeriodMs?: number
  rotationPeriodMsgs?: number
} | null>(null)

const loadEncryptionStatus = async () => {
  if (!props.roomId) return
  loading.value = true
  try {
    isEncrypted.value = await encryption.isRoomEncrypted(props.roomId)
    if (isEncrypted.value) {
      const settings = await encryption.getEncryptionSettings(props.roomId)
      encryptionSettings.value = settings
    } else {
      encryptionSettings.value = null
    }
  } catch {
    isEncrypted.value = false
    encryptionSettings.value = null
  } finally {
    loading.value = false
  }
}

const handleEnableEncryption = async () => {
  if (!props.roomId) return
  enabling.value = true
  try {
    await encryption.enableRoomEncryption(props.roomId)
    showFeedback(t('encryption.room_settings.enable_success'), 'success')
    await loadEncryptionStatus()
  } catch {
    showFeedback(t('encryption.room_settings.enable_failed'), 'error')
  } finally {
    enabling.value = false
  }
}

const formatDuration = (ms: number): string => {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) {
    return t('encryption.room_settings.days_hours', { days, hours })
  }
  const minutes = Math.floor(ms / (1000 * 60))
  return t('encryption.room_settings.minutes', { minutes })
}

watch(
  () => props.roomId,
  (newId) => {
    if (newId) {
      loadEncryptionStatus()
    } else {
      isEncrypted.value = false
      encryptionSettings.value = null
    }
  },
  { immediate: true }
)
</script>
