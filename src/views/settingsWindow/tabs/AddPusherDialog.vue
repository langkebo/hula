<template>
  <n-modal v-model:show="visible" preset="dialog" :title="t('setting.push.add_pusher.title')">
    <n-form label-placement="left" label-width="auto">
      <n-form-item :label="t('setting.push.add_pusher.kind_label')">
        <n-select v-model:value="newPusher.kind" :options="pusherKindOptions" />
      </n-form-item>
      <n-form-item :label="t('setting.push.add_pusher.app_id_label')">
        <n-input v-model:value="newPusher.app_id" :placeholder="t('setting.push.add_pusher.app_id_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.push.add_pusher.app_display_name_label')">
        <n-input
          v-model:value="newPusher.app_display_name"
          :placeholder="t('setting.push.add_pusher.app_display_name_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.push.add_pusher.device_display_name_label')">
        <n-input
          v-model:value="newPusher.device_display_name"
          :placeholder="t('setting.push.add_pusher.device_display_name_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.push.add_pusher.pushkey_label')">
        <n-input v-model:value="newPusher.pushkey" :placeholder="t('setting.push.add_pusher.pushkey_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.push.add_pusher.lang_label')">
        <n-input v-model:value="newPusher.lang" placeholder="en" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-button @click="visible = false">{{ t('setting.push.add_pusher.cancel') }}</n-button>
      <n-button type="primary" @click="handleAddPusher">{{ t('setting.push.add_pusher.confirm') }}</n-button>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NForm, NFormItem, NInput, NModal, NSelect } from 'naive-ui'
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AddPusherDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const visible = defineModel<boolean>('show', { default: false })
const emit = defineEmits<{
  added: []
}>()

const newPusher = reactive({
  kind: 'http',
  app_id: '',
  app_display_name: '',
  device_display_name: '',
  pushkey: '',
  lang: 'en'
})

const pusherKindOptions = [
  { label: 'Web (HTTP)', value: 'http' },
  { label: 'APNs (iOS)', value: 'apns' },
  { label: 'FCM (Android)', value: 'fcm' }
]

async function handleAddPusher() {
  if (!newPusher.app_id || !newPusher.pushkey) {
    showFeedback(t('setting.push.add_pusher.required'), 'warning')
    return
  }
  try {
    await matrixNotificationService.setPusherByBody({
      kind: newPusher.kind,
      app_id: newPusher.app_id,
      app_display_name: newPusher.app_display_name,
      device_display_name: newPusher.device_display_name,
      pushkey: newPusher.pushkey,
      lang: newPusher.lang || 'en',
      data: {}
    })
    showFeedback(t('setting.push.add_pusher.success'), 'success')
    visible.value = false
    resetNewPusher()
    emit('added')
  } catch (error) {
    logger.error('Failed to add pusher', error)
    showFeedback(t('setting.push.add_pusher.failed'), 'error')
  }
}

function resetNewPusher() {
  newPusher.kind = 'http'
  newPusher.app_id = ''
  newPusher.app_display_name = ''
  newPusher.device_display_name = ''
  newPusher.pushkey = ''
  newPusher.lang = 'en'
}
</script>
