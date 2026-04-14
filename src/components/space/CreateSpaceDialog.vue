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
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpaceStore, type Space } from '@/stores/space'
import { matrixSpaceService } from '@/services/matrix/MatrixSpaceService'
import { matrixMediaService } from '@/services/matrix/MatrixMediaService'
import { createLogger } from '@/utils/Logger'
import type { UploadCustomRequestOptions } from 'naive-ui'
import type { FormInst } from 'naive-ui'

const logger = createLogger('CreateSpaceDialog')
const { t } = useI18n()
const spaceStore = useSpaceStore()

const props = withDefaults(
  defineProps<{
    visible: boolean
    editMode?: boolean
    space?: Space | null
  }>(),
  {
    visible: false,
    editMode: false,
    space: null
  }
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [space: { spaceId: string; name: string; avatarUrl?: string; memberCount: number; topic?: string }]
  updated: [space: { spaceId: string; name: string; avatarUrl?: string; memberCount: number; topic?: string }]
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

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.editMode && props.space) {
      formData.name = props.space.name || ''
      formData.topic = props.space.topic || ''
      formData.avatarUrl = props.space.avatarUrl || ''
    }
  }
)

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file
    if (!file) return
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

    if (props.editMode && props.space) {
      await matrixSpaceService.updateSpace(props.space.roomId, {
        name: formData.name,
        topic: formData.topic,
        avatarUrl: formData.avatarUrl || undefined
      })
      emit('updated', {
        spaceId: props.space.roomId,
        name: formData.name,
        avatarUrl: formData.avatarUrl || undefined,
        memberCount: props.space.memberCount,
        topic: formData.topic
      })
    } else {
      const newSpace = await matrixSpaceService.createSpace({
        name: formData.name,
        topic: formData.topic,
        avatarUrl: formData.avatarUrl || undefined
      })
      if (newSpace) {
        emit('created', {
          spaceId: newSpace.spaceId,
          name: newSpace.name,
          avatarUrl: newSpace.avatarUrl || undefined,
          memberCount: newSpace.memberCount,
          topic: newSpace.topic
        })
        spaceStore.addSpace({
          roomId: newSpace.spaceId,
          name: newSpace.name,
          avatarUrl: newSpace.avatarUrl ?? null,
          memberCount: newSpace.memberCount,
          isJoined: true,
          spaceId: newSpace.spaceId
        })
      }
    }
    emit('update:visible', false)
  } catch (error) {
    logger.error('[CreateSpaceDialog] 操作失败:', error)
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
