<template>
  <div class="create-space-dialog">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-form-item :label="t('space.create.name')" path="name">
        <n-input v-model:value="formData.name" :placeholder="t('space.create.name_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('space.create.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('space.create.topic_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('space.create.avatar')" path="avatarUrl">
        <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
          <n-avatar round :size="64" />
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
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSpaceStore } from '@/stores/domains/widget/space'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { createLogger } from '@/utils/Logger'

import type { FormInst, UploadCustomRequestOptions } from 'naive-ui'

const logger = createLogger('CreateSpaceDialog')
const { t } = useI18n()
const router = useRouter()
const spaceStore = useSpaceStore()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
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
    message: t('space.create.name_required')
  }
}

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file as File
    const result = await matrixMediaService.uploadFile(file)
    formData.avatarUrl = result.contentUri
  } catch (error) {
    logger.error('[CreateSpaceDialog] 上传头像失败:', error)
  }
}

const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    await matrixSpaceService.createSpace({
      name: formData.name,
      topic: formData.topic,
      avatarUrl: formData.avatarUrl
    })
    emit('update:visible', false)
  } catch (error) {
    logger.error('[CreateSpaceDialog] 创建空间失败:', error)
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  emit('update:visible', false)
}
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
