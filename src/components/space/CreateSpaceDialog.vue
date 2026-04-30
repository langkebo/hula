<template>
  <div class="create-space-dialog">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-form-item :label="t('space.name')" path="name">
        <n-input v-model:value="formData.name" :placeholder="t('space.name_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('space.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('space.topic_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('space.name')" path="avatarUrl">
        <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
          <n-avatar round :size="64" :src="formData.avatarUrl || undefined" />
        </n-upload>
      </n-form-item>
    </n-form>

    <div class="dialog-footer">
      <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="loading" @click="handleSubmit">
        {{ t('common.create') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, UploadCustomRequestOptions } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixSpaceService, type SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CreateSpaceDialog')
const { t } = useI18n()
const message = useMessage()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [space: SpaceInfo]
}>()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: ''
})

const rules = {
  name: {
    required: true,
    message: t('space.name_required')
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.avatarUrl = ''
}

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file as File
    const result = await matrixMediaService.uploadFile(file)
    formData.avatarUrl = result.contentUri
    options.onFinish()
  } catch (error) {
    logger.error('[CreateSpaceDialog] 上传头像失败:', error)
    options.onError()
  }
}

const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    const createdSpace = await matrixSpaceService.createSpace({
      name: formData.name,
      topic: formData.topic,
      avatarUrl: formData.avatarUrl
    })
    if (!createdSpace) {
      message.error(t('space.create_failed'))
      return
    }
    message.success(t('space.create_success'))
    emit('created', createdSpace)
    resetForm()
    emit('update:visible', false)
  } catch (error) {
    logger.error('[CreateSpaceDialog] 创建空间失败:', error)
    message.error(t('space.create_failed'))
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  resetForm()
  emit('update:visible', false)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) return
    resetForm()
  }
)
</script>

<style scoped lang="scss">
.create-space-dialog {
  padding: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
