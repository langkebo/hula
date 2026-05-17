<template>
  <div class="workbench-quick-create">
    <div class="workbench-quick-create__header">
      <span class="text-13px font-600">{{ isSpaceMode ? t('space.create') : t('room.create.title') }}</span>
      <button type="button" class="workbench-quick-create__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>

    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top" :show-feedback="false">
      <n-form-item :label="isSpaceMode ? t('space.name') : t('room.create.name')" path="name">
        <n-input
          v-model:value="formData.name"
          size="small"
          :placeholder="isSpaceMode ? t('space.name_placeholder') : t('room.create.name_placeholder')"
          @keydown.enter="handleSubmit" />
      </n-form-item>

      <n-form-item :label="isSpaceMode ? t('space.topic') : t('room.create.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          size="small"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="isSpaceMode ? t('space.topic_placeholder') : t('room.create.topic_placeholder')" />
      </n-form-item>

      <n-form-item :label="isSpaceMode ? t('space.avatar') : t('room.create.avatar')" path="avatarUrl">
        <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
          <div class="workbench-quick-create__avatar-upload">
            <n-avatar round :size="40" :src="formData.avatarUrl || undefined" />
            <span class="text-11px color-[--hula-text-tertiary]">
              {{ isSpaceMode ? t('space.upload_avatar') : t('room.create.avatar') }}
            </span>
          </div>
        </n-upload>
      </n-form-item>

      <template v-if="!isSpaceMode">
        <n-form-item :label="t('room.create.visibility')" path="isPublic">
          <n-radio-group v-model:value="formData.isPublic" size="small">
            <n-radio :value="false">{{ t('room.create.private') }}</n-radio>
            <n-radio :value="true">{{ t('room.create.public') }}</n-radio>
          </n-radio-group>
        </n-form-item>

        <n-form-item v-if="formData.isPublic" :label="t('room.create.alias')" path="alias">
          <n-input v-model:value="formData.alias" size="small" :placeholder="t('room.create.alias_placeholder')">
            <template #prefix>#</template>
          </n-input>
        </n-form-item>

        <n-form-item :label="t('room.create.encryption')" path="isEncrypted">
          <div class="flex items-center gap-8px">
            <n-switch v-model:value="formData.isEncrypted" size="small" />
            <span class="text-12px color-[--hula-text-tertiary]">
              {{ formData.isEncrypted ? t('room.create.encrypted') : t('room.create.not_encrypted') }}
            </span>
          </div>
        </n-form-item>

        <n-form-item :label="t('room.create.history_visibility')" path="historyVisibility">
          <n-select
            v-model:value="formData.historyVisibility"
            size="small"
            :options="historyOptions"
            :placeholder="t('room.create.history_visibility_placeholder')" />
        </n-form-item>
      </template>

      <n-flex justify="end" :size="8" class="mt-12px">
        <n-button size="small" @click="emit('close')">{{ t('common.cancel') }}</n-button>
        <n-button size="small" type="primary" :loading="loading" @click="handleSubmit">
          {{ t('common.create') }}
        </n-button>
      </n-flex>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type SpaceInfo, useSpaces } from '@/composables/space'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { roomNavigationService } from '@/services/matrix/room/RoomNavigationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WorkbenchQuickCreate')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { create: createSpace } = useSpaces()

const props = defineProps<{
  isSpaceMode?: boolean
}>()

const emit = defineEmits<{
  close: []
  created: [data: { roomId?: string; space?: SpaceInfo }]
}>()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const serverDomain = ref('matrix.org')

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  isPublic: false,
  alias: '',
  isEncrypted: false,
  historyVisibility: 'shared' as 'shared' | 'invited' | 'joined' | 'world_readable'
})

const rules: FormRules = {
  name: [
    { required: true, message: t('room.create.name_required'), trigger: 'blur' },
    { min: 1, max: 100, message: t('room.create.name_length'), trigger: 'blur' }
  ]
}

const historyOptions = [
  { label: t('room.create.history_shared'), value: 'shared' },
  { label: t('room.create.history_invited'), value: 'invited' },
  { label: t('room.create.history_joined'), value: 'joined' },
  { label: t('room.create.history_world_readable'), value: 'world_readable' }
]

const loadServerDomain = async () => {
  try {
    serverDomain.value = await roomNavigationService.getServerDomain()
  } catch (error) {
    logger.error('Failed to get server domain:', error)
  }
}

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file as File
    const result = await matrixMediaService.uploadFile(file)
    formData.avatarUrl = result.contentUri
    options.onFinish()
  } catch (error) {
    logger.error('[QuickCreate] upload avatar failed:', error)
    options.onError()
  }
}

const handleCreateSpace = async () => {
  const created = await createSpace({
    name: formData.name,
    topic: formData.topic,
    avatarUrl: formData.avatarUrl
  })
  if (!created) {
    showFeedback(t('space.create_failed'), 'error')
    return
  }
  showFeedback(t('space.create_success'), 'success')
  emit('created', { space: created })
  resetForm()
}

const handleCreateRoom = async () => {
  const room = await roomNavigationService.createGroupRoom({
    name: formData.name,
    topic: formData.topic,
    avatarUrl: formData.avatarUrl || undefined,
    isPublic: formData.isPublic,
    alias: formData.alias || undefined,
    isEncrypted: formData.isEncrypted,
    historyVisibility: formData.historyVisibility
  })
  showFeedback(t('room.create.success'), 'success')
  emit('created', { roomId: room?.roomId || '' })
  resetForm()
}

const handleSubmit = async () => {
  try {
    loading.value = true
    await formRef.value?.validate()
    if (props.isSpaceMode) {
      await handleCreateSpace()
    } else {
      await handleCreateRoom()
    }
  } catch (error) {
    if (error !== false) {
      logger.error('[QuickCreate] create failed:', error)
      showFeedback(props.isSpaceMode ? t('space.create_failed') : t('room.create.failed'), 'error')
    }
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.avatarUrl = ''
  formData.isPublic = false
  formData.alias = ''
  formData.isEncrypted = false
  formData.historyVisibility = 'shared'
}

watch(
  () => props.isSpaceMode,
  (isSpace) => {
    if (!isSpace) {
      void loadServerDomain()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.workbench-quick-create {
  padding: 16px;
}

.workbench-quick-create__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.workbench-quick-create__close {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.workbench-quick-create__avatar-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}
</style>
