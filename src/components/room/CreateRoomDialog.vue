<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('room.create.title')"
    :style="{ width: '480px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
      <n-form-item :label="t('room.create.name')" path="name">
        <n-input v-model:value="formData.name" :placeholder="t('room.create.name_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('room.create.topic')" path="topic">
        <n-input
          v-model:value="formData.topic"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('room.create.topic_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('room.create.avatar')" path="avatarUrl">
        <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
          <n-avatar round :size="64" :src="formData.avatarUrl || defaultAvatar" class="cursor-pointer" />
        </n-upload>
      </n-form-item>

      <n-form-item :label="t('room.create.type')" path="isPublic">
        <n-radio-group v-model:value="formData.isPublic">
          <n-radio :value="false">{{ t('room.create.private') }}</n-radio>
          <n-radio :value="true">{{ t('room.create.public') }}</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item v-if="formData.isPublic" :label="t('room.create.alias')" path="alias">
        <n-input-group>
          <n-input-group-label>#</n-input-group-label>
          <n-input v-model:value="formData.alias" :placeholder="t('room.create.alias_placeholder')" />
          <n-input-group-label>:{{ serverDomain }}</n-input-group-label>
        </n-input-group>
      </n-form-item>

      <n-form-item :label="t('room.create.encryption')" path="isEncrypted">
        <n-switch v-model:value="formData.isEncrypted" />
        <span class="ml-8px text-12px color-#909090">{{ t('room.create.encryption_hint') }}</span>
      </n-form-item>

      <n-form-item :label="t('room.create.history')" path="historyVisibility">
        <n-select
          v-model:value="formData.historyVisibility"
          :options="historyOptions"
          :placeholder="t('room.create.history_placeholder')" />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreate">
          {{ t('room.create.create') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { matrixRoomService } from '@/services/matrix'
import { matrixMediaService } from '@/services/matrix'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { Visibility, Preset } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('CreateRoomDialog')

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'created', roomId: string): void
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
  alias: '',
  isEncrypted: false,
  historyVisibility: 'shared'
})

const rules: FormRules = {
  name: [
    { required: true, message: t('room.create.name_required'), trigger: 'blur' },
    { min: 2, max: 100, message: t('room.create.name_length'), trigger: 'blur' }
  ]
}

const historyOptions = [
  { label: t('room.create.history_shared'), value: 'shared' },
  { label: t('room.create.history_invited'), value: 'invited' },
  { label: t('room.create.history_joined'), value: 'joined' },
  { label: t('room.create.history_world_readable'), value: 'world_readable' }
]

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
    logger.error('上传头像失败:', error)
    window.$message?.error(t('room.create.avatar_upload_failed'))
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
    const initialState: any[] = []

    if (formData.isEncrypted) {
      initialState.push({
        type: 'm.room.encryption',
        state_key: '',
        content: {
          algorithm: 'm.megolm.v1.aes-sha2'
        }
      })
    }

    if (formData.historyVisibility !== 'shared') {
      initialState.push({
        type: 'm.room.history_visibility',
        state_key: '',
        content: {
          history_visibility: formData.historyVisibility
        }
      })
    }

    const room = await matrixRoomService.createRoom({
      name: formData.name,
      topic: formData.topic,
      room_alias_name: formData.alias || undefined,
      visibility: formData.isPublic ? Visibility.Public : Visibility.Private,
      preset: formData.isPublic ? Preset.PublicChat : Preset.PrivateChat,
      initial_state: initialState.length > 0 ? initialState : undefined
    })

    if (formData.avatarUrl && room) {
      const client = (await import('@/services/matrix/MatrixClientService')).default.getClient()
      if (client) {
        await client.sendStateEvent(room.roomId, 'm.room.avatar' as any, { url: formData.avatarUrl }, '')
      }
    }

    window.$message?.success(t('room.create.success'))
    emit('created', room?.roomId || '')
    emit('update:visible', false)
    resetForm()
  } catch (error) {
    logger.error('创建房间失败:', error)
    window.$message?.error(t('room.create.failed'))
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
  formData.isEncrypted = false
  formData.historyVisibility = 'shared'
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
