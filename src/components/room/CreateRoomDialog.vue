<template>
  <n-modal
    :show="visible"
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

      <n-form-item :label="t('room.create.type')" path="roomType">
        <n-radio-group v-model:value="formData.roomType">
          <n-radio value="room">{{ t('room.create.public') }}</n-radio>
          <n-radio value="private_room">{{ t('room.create.private') }}</n-radio>
          <n-radio value="space">{{ t('room.create.space') }}</n-radio>
        </n-radio-group>
      </n-form-item>
      <div class="text-12px color-[--hula-text-tertiary] mb-16px">{{ t('room.create.room_type_hint') }}</div>

      <n-form-item v-if="isPublic" :label="t('room.create.alias')" path="alias">
        <n-input-group>
          <n-input-group-label>#</n-input-group-label>
          <n-input v-model:value="formData.alias" :placeholder="t('room.create.alias_placeholder')" />
          <n-input-group-label>:{{ serverDomain }}</n-input-group-label>
        </n-input-group>
      </n-form-item>

      <n-form-item :label="t('room.create.encryption')" path="isEncrypted">
        <n-switch v-model:value="formData.isEncrypted" />
        <span class="ml-8px text-12px color-[--hula-text-tertiary]">{{ t('room.create.encryption_hint') }}</span>
      </n-form-item>

      <n-form-item :label="t('room.create.history')" path="historyVisibility">
        <n-select
          v-model:value="formData.historyVisibility"
          :options="historyOptions"
          :placeholder="t('room.create.history_placeholder')" />
      </n-form-item>

      <n-form-item v-if="formData.roomType !== 'space'" :label="t('room.create.join_rule')" path="joinRule">
        <n-select
          v-model:value="formData.joinRule"
          :options="joinRuleOptions"
          :placeholder="t('room.create.join_rule_placeholder')" />
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
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useRoomActions } from '@/composables/room/useRoomActions'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
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
const { showFeedback } = useActionFeedback()
const { createGroupRoom, getServerDomain } = useRoomActions()
const formRef = ref<FormInst>()
const creating = ref(false)
const defaultAvatar = '/logoD.png'
const serverDomain = ref('matrix.org')

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  roomType: 'room' as 'room' | 'private_room' | 'space',
  alias: '',
  isEncrypted: false,
  historyVisibility: 'shared' as 'shared' | 'invited' | 'joined' | 'world_readable',
  joinRule: 'invite' as 'invite' | 'knock' | 'public' | 'restricted'
})

const isPublic = computed(() => formData.roomType === 'room')

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

const joinRuleOptions = [
  { label: t('room.create.join_rule_invite'), value: 'invite' },
  { label: t('room.create.join_rule_knock'), value: 'knock' },
  { label: t('room.create.join_rule_public'), value: 'public' },
  { label: t('room.create.join_rule_restricted'), value: 'restricted' }
]

const loadServerDomain = async () => {
  try {
    serverDomain.value = await getServerDomain()
  } catch (error) {
    logger.error('获取 homeserver 域名失败:', error)
    serverDomain.value = 'matrix.org'
  }
}

const handleAvatarUpload = async ({ file }: UploadCustomRequestOptions) => {
  try {
    const uploadFile = file.file
    if (!uploadFile) return

    const result = await matrixMediaService.uploadFile(uploadFile)
    formData.avatarUrl = result.contentUri
  } catch (error) {
    logger.error('上传头像失败:', error)
    showFeedback(t('room.create.avatar_upload_failed'), 'error')
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
    const room = await createGroupRoom({
      name: formData.name,
      topic: formData.topic,
      avatarUrl: formData.avatarUrl || undefined,
      isPublic: formData.roomType === 'room',
      alias: formData.alias || undefined,
      isEncrypted: formData.isEncrypted,
      historyVisibility: formData.historyVisibility,
      joinRule: formData.joinRule
    })

    showFeedback(t('room.create.success'), 'success')
    emit('created', room?.roomId || '')
    emit('update:visible', false)
    resetForm()
  } catch (error) {
    logger.error('创建房间失败:', error)
    showFeedback(t('room.create.failed'), 'error')
  } finally {
    creating.value = false
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.avatarUrl = ''
  formData.roomType = 'room'
  formData.alias = ''
  formData.isEncrypted = false
  formData.historyVisibility = 'shared'
  formData.joinRule = 'invite'
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      void loadServerDomain()
    } else {
      resetForm()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.dialog-footer {
  @apply flex justify-end gap-12px;
}
</style>
