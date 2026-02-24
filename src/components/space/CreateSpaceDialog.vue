<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('space.create.title')"
    :style="{ width: '480px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
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
        <n-upload
          :max="1"
          accept="image/*"
          :custom-request="handleAvatarUpload"
          :show-file-list="false">
          <n-avatar
            round
            :size="64"
            :src="formData.avatarUrl || defaultAvatar"
            class="cursor-pointer" />
        </n-upload>
      </n-form-item>

      <n-form-item :label="t('space.create.visibility')" path="isPublic">
        <n-radio-group v-model:value="formData.isPublic">
          <n-radio :value="false">{{ t('space.create.private') }}</n-radio>
          <n-radio :value="true">{{ t('space.create.public') }}</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item v-if="formData.isPublic" :label="t('space.create.alias')" path="alias">
        <n-input-group>
          <n-input-group-label>#</n-input-group-label>
          <n-input
            v-model:value="formData.alias"
            :placeholder="t('space.create.alias_placeholder')" />
          <n-input-group-label>:{{ serverDomain }}</n-input-group-label>
        </n-input-group>
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreate">
          {{ t('space.create.create') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { matrixSpaceService } from '@/services/matrix'
import { matrixMediaService } from '@/services/matrix'
import matrixClientService from '@/services/matrix/MatrixClientService'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'created', spaceId: string): void
}>()

const { t } = useI18n()
const formRef = ref<FormInst>()
const creating = ref(false)
const defaultAvatar = '/logoD.png'

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  isPublic: false,
  alias: ''
})

const rules: FormRules = {
  name: [
    { required: true, message: t('space.create.name_required'), trigger: 'blur' },
    { min: 2, max: 100, message: t('space.create.name_length'), trigger: 'blur' }
  ]
}

const serverDomain = computed(() => {
  const client = matrixClientService.getClient()
  return client?.getDomain() || 'matrix.org'
})

const handleAvatarUpload = async ({ file }: UploadCustomRequestOptions) => {
  try {
    const uploadFile = file.file
    if (!uploadFile) return

    const result = await matrixMediaService.uploadFile(uploadFile)
    formData.avatarUrl = result.contentUri
  } catch (error) {
    console.error('[CreateSpaceDialog] 上传头像失败:', error)
    window.$message?.error(t('space.create.avatar_upload_failed'))
  }
}

const handleCreate = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  creating.value = true
  try {
    const spaceId = await matrixSpaceService.createSpace({
      name: formData.name,
      topic: formData.topic,
      avatarUrl: formData.avatarUrl,
      isPublic: formData.isPublic,
      alias: formData.alias
    })

    window.$message?.success(t('space.create.success'))
    emit('created', spaceId)
    emit('update:visible', false)
    resetForm()
  } catch (error) {
    console.error('[CreateSpaceDialog] 创建空间失败:', error)
    window.$message?.error(t('space.create.failed'))
  } finally {
    creating.value = false
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.avatarUrl = ''
  formData.isPublic = false
  formData.alias = ''
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      resetForm()
    }
  }
)
</script>

<style scoped lang="scss">
.dialog-footer {
  @apply flex justify-end gap-12px;
}
</style>
