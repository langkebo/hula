<template>
  <n-modal
    :show="props.visible"
    @update:show="emit('update:visible', $event)"
    preset="dialog"
    :title="t('room.create.title')"
    positive-text="确认"
    negative-text="取消"
    :loading="loading"
    @positive-click="handleSubmit"
    @negative-click="handleCancel">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-form-item :label="t('room.create.name')" path="name">
        <n-input v-model:value="formData.name" :placeholder="t('room.create.name_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('room.create.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :placeholder="t('room.create.topic_placeholder')"
          :autosize="{ minRows: 2, maxRows: 4 }" />
      </n-form-item>

      <n-form-item :label="t('room.create.type')" path="isPublic">
        <n-radio-group v-model:value="formData.isPublic">
          <n-radio :value="false">{{ t('room.create.private') }}</n-radio>
          <n-radio :value="true">{{ t('room.create.public') }}</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item :label="t('room.create.avatar')" path="avatarUrl">
        <n-upload
          :max="1"
          accept="image/*"
          :custom-request="handleAvatarUpload"
          :show-file-list="false">
          <n-button>
            <template #icon>
              <Icon icon="mdi:upload" :width="18" />
            </template>
            {{ t('room.create.upload_avatar') }}
          </n-button>
        </n-upload>
        <n-avatar v-if="formData.avatarUrl" :src="formData.avatarUrl" :size="48" round class="ml-12px" />
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { NModal, NForm, NFormItem, NInput, NRadioGroup, NRadio, NUpload, NButton, NAvatar, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import { matrixMediaService } from '@/services/matrix/MatrixMediaService'
import { createLogger } from '@/utils/Logger'
import type { FormInst, UploadCustomRequestOptions } from 'naive-ui'

const logger = createLogger('CreateRoomDialog')
const { t } = useI18n()
const message = useMessage()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [room: any]
}>()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  isPublic: false,
  avatarUrl: ''
})

const rules = {
  name: {
    required: true,
    message: t('room.create.name_required')
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      formData.name = ''
      formData.topic = ''
      formData.isPublic = false
      formData.avatarUrl = ''
    }
  }
)

async function handleAvatarUpload(options: UploadCustomRequestOptions) {
  try {
    const file = options.file.file
    if (!file) return
    const result = await matrixMediaService.uploadFile(file)
    formData.avatarUrl = result.contentUri
  } catch (error) {
    logger.error('上传头像失败:', error)
    message.error(t('room.create.upload_failed'))
  }
}

async function handleSubmit() {
  try {
    loading.value = true
    await formRef.value?.validate()

    const room = await matrixRoomService.createRoom({
      name: formData.name,
      topic: formData.topic,
      preset: formData.isPublic ? 'public_chat' : 'private_chat',
      initial_state: formData.avatarUrl
        ? [
            {
              type: 'm.room.avatar',
              state_key: '',
              content: {
                url: formData.avatarUrl
              }
            }
          ]
        : []
    })

    emit('created', room)
    emit('update:visible', false)
    message.success(t('room.create.success'))
  } catch (error) {
    logger.error('创建房间失败:', error)
    message.error(t('room.create.failed'))
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  emit('update:visible', false)
}
</script>
