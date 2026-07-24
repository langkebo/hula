<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="stage === 'create' ? t('room.create.title') : t('room.create.invite_title')"
    :style="{ width: '480px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <!-- 阶段 1: 创建房间 -->
    <n-form
      v-if="stage === 'create'"
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="80">
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
    </n-form>

    <!-- 阶段 2: 邀请成员（可选） -->
    <div v-else-if="stage === 'invite'" class="invite-stage">
      <p class="text-14px color-[--hula-text-secondary] mb-16px">{{ t('room.create.invite_desc') }}</p>
      <n-input
        v-model:value="inviteInput"
        :placeholder="t('room.create.invite_placeholder')"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 4 }" />
    </div>

    <template #footer>
      <div class="dialog-footer">
        <template v-if="stage === 'create'">
          <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreate">
            {{ t('room.create.create') }}
          </n-button>
        </template>
        <template v-else>
          <n-button @click="handleSkipInvite">{{ t('room.create.invite_skip') }}</n-button>
          <n-button type="primary" :loading="inviting" @click="handleInvite">
            {{ t('room.create.invite_send') }}
          </n-button>
        </template>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
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
const formRef = ref<FormInst>()
const creating = ref(false)
const inviting = ref(false)
const defaultAvatar = '/logoD.png'
const serverDomain = ref('matrix.org')

/** 流程阶段：create（创建） → invite（邀请成员，可选） */
const stage = ref<'create' | 'invite'>('create')
/** 已创建的房间 ID（邀请阶段使用） */
const createdRoomId = ref('')
/** 邀请输入（用户 ID 或房间别名，逗号分隔） */
const inviteInput = ref('')

const formData = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  roomType: 'private_room' as 'room' | 'private_room' | 'space',
  alias: '',
  isEncrypted: true,
  historyVisibility: 'shared' as 'shared' | 'invited' | 'joined' | 'world_readable',
  joinRule: 'invite' as 'invite' | 'knock' | 'public' | 'restricted'
})

const rules: FormRules = {
  name: [
    { required: true, message: t('room.create.name_required'), trigger: 'blur' },
    { min: 2, max: 100, message: t('room.create.name_length'), trigger: 'blur' }
  ]
}

const loadServerDomain = async () => {
  try {
    serverDomain.value = await matrixRoomReadFacade.getServerDomain()
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
    const room = await matrixRoomActionFacade.createGroupRoom({
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
    createdRoomId.value = room?.roomId || ''
    emit('created', createdRoomId.value)
    // 切换到邀请阶段（可选步骤）
    stage.value = 'invite'
  } catch (error) {
    logger.error('创建房间失败:', error instanceof Error ? error.message : String(error))
    showFeedback(t('room.create.failed'), 'error')
  } finally {
    creating.value = false
  }
}

const handleSkipInvite = () => {
  emit('update:visible', false)
  resetForm()
}

const handleInvite = async () => {
  const userIds = inviteInput.value
    .split(/[,\n\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (userIds.length === 0) {
    handleSkipInvite()
    return
  }

  inviting.value = true
  try {
    for (const userId of userIds) {
      await matrixRoomActionFacade.inviteUser(createdRoomId.value, userId)
    }
    showFeedback(t('room.create.invite_success'), 'success')
  } catch (error) {
    logger.error('邀请成员失败:', error instanceof Error ? error.message : String(error))
    showFeedback(t('room.create.invite_failed'), 'error')
  } finally {
    inviting.value = false
    emit('update:visible', false)
    resetForm()
  }
}

const resetForm = () => {
  formData.name = ''
  formData.topic = ''
  formData.avatarUrl = ''
  formData.roomType = 'private_room'
  formData.alias = ''
  formData.isEncrypted = true
  formData.historyVisibility = 'shared'
  formData.joinRule = 'invite'
  inviteInput.value = ''
  createdRoomId.value = ''
  stage.value = 'create'
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
