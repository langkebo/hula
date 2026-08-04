<template>
  <div class="create-room-pane flex-1 min-h-0 flex flex-col">
    <!-- 顶部标题栏 -->
    <div
      class="pane-header flex items-center justify-between px-20px py-12px border-b border-[--tjg-border-layout-divider]">
      <span class="pane-title">{{ t('room.create.title') }}</span>
      <n-button text @click="handleClose">
        <svg class="size-16px"><use href="#close"></use></svg>
      </n-button>
    </div>

    <!-- 草稿恢复提示 -->
    <Transition name="hint-fade">
      <div v-if="showRestoredHint" class="create-room-pane__hint" role="status" aria-live="polite">
        <svg class="size-14px"><use href="#info"></use></svg>
        <span>{{ t('common.draft_restored', '已恢复上次编辑内容') }}</span>
      </div>
    </Transition>

    <!-- 阶段 1: 创建房间 -->
    <n-scrollbar v-if="stage === 'create'" class="flex-1 min-h-0">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="left"
        label-width="80"
        class="px-20px py-16px">
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

        <n-form-item path="avatarUrl">
          <span class="avatar-label">{{ t('room.create.avatar') }}</span>
          <div class="avatar-preview">
            <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
              <n-avatar round :size="64" :src="formData.avatarUrl || defaultAvatar" class="cursor-pointer" />
            </n-upload>
          </div>
        </n-form-item>

        <n-form-item :label="t('room.create.type')" path="roomType">
          <n-radio-group v-model:value="formData.roomType">
            <n-radio value="room">{{ t('room.create.public') }}</n-radio>
            <n-radio value="private_room">{{ t('room.create.private') }}</n-radio>
            <n-radio value="space">{{ t('room.create.space') }}</n-radio>
          </n-radio-group>
        </n-form-item>
        <div class="text-12px color-[--tjg-text-tertiary] mb-16px">{{ t('room.create.room_type_hint') }}</div>

        <n-form-item :label="t('room.create.encryption')" path="isEncrypted">
          <n-switch v-model:value="formData.isEncrypted" />
          <span class="text-12px color-[--tjg-text-tertiary] ml-12px">{{ t('room.create.encryption_hint') }}</span>
        </n-form-item>

        <n-form-item :label="t('room.create.history')" path="historyVisibility">
          <n-select
            v-model:value="formData.historyVisibility"
            :options="historyVisibilityOptions"
            :placeholder="t('room.create.history_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('room.create.join_rule')" path="joinRule">
          <n-select
            v-model:value="formData.joinRule"
            :options="joinRuleOptions"
            :placeholder="t('room.create.join_rule_placeholder')" />
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <!-- 阶段 2: 邀请成员（可选） -->
    <div v-else-if="stage === 'invite'" class="flex-1 min-h-0 flex flex-col px-20px py-16px">
      <p class="text-14px color-[--tjg-text-secondary] mb-16px">{{ t('room.create.invite_desc') }}</p>
      <n-input
        v-model:value="inviteInput"
        :placeholder="t('room.create.invite_placeholder')"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 8 }" />
    </div>

    <!-- 底部操作栏 -->
    <div
      class="create-room-pane__footer flex items-center justify-end gap-12px px-20px py-12px border-t border-[--tjg-border-layout-divider]">
      <template v-if="stage === 'create'">
        <n-button @click="handleClose">{{ t('room.create.cancel') }}</n-button>
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
  </div>
</template>

<script setup lang="ts">
import type { FormInst, FormRules, UploadCustomRequestOptions } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { RoomTypeEnum } from '@/enums'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import { useRightViewDraftStore } from '@/stores/domains/widget/rightViewDraft'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CreateRoomPane')
const RESTORED_HINT_DURATION = 3000

const emit = defineEmits<(e: 'close') => void>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const draftStore = useRightViewDraftStore()
const formRef = ref<FormInst>()
const creating = ref(false)
const inviting = ref(false)
const defaultAvatar = '/logoD.png'
const serverDomain = ref('matrix.org')

const handleClose = () => {
  emit('close')
}

/** 流程阶段：create（创建） → invite（邀请成员，可选） */
const stage = ref<'create' | 'invite'>('create')
/** 已创建的房间 ID（邀请阶段使用） */
const createdRoomId = ref('')
/** 邀请输入（用户 ID 或房间别名，逗号分隔） */
const inviteInput = ref('')

const showRestoredHint = ref(false)

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

const historyVisibilityOptions = computed(() => [
  { label: t('room.create.history_shared'), value: 'shared' },
  { label: t('room.create.history_invited'), value: 'invited' },
  { label: t('room.create.history_joined'), value: 'joined' },
  { label: t('room.create.history_world_readable'), value: 'world_readable' }
])

const joinRuleOptions = computed(() => [
  { label: t('room.create.join_rule_invite'), value: 'invite' },
  { label: t('room.create.join_rule_knock'), value: 'knock' },
  { label: t('room.create.join_rule_public'), value: 'public' },
  { label: t('room.create.join_rule_restricted'), value: 'restricted' }
])

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
    // 创建成功后清除草稿
    draftStore.clearCreateRoom()
    // 切换到邀请阶段（可选步骤）
    stage.value = 'invite'
  } catch (error) {
    logger.error('创建房间失败:', error instanceof Error ? error.message : String(error))
    showFeedback(t('room.create.failed'), 'error')
  } finally {
    creating.value = false
  }
}

const handleSkipInvite = async () => {
  // 直接进入刚创建的房间
  if (createdRoomId.value) {
    await openMsgSession(createdRoomId.value, RoomTypeEnum.GROUP)
  }
  const { default: router } = await import('@/router')
  void router.back()
}

const handleInvite = async () => {
  const userIds = inviteInput.value
    .split(/[,\n\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (userIds.length === 0) {
    await handleSkipInvite()
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
    // 邀请结束后进入房间
    if (createdRoomId.value) {
      await openMsgSession(createdRoomId.value, RoomTypeEnum.GROUP)
    }
    const { default: router } = await import('@/router')
    void router.back()
  }
}

// 自动同步草稿
watch(
  formData,
  (value) => {
    draftStore.saveCreateRoom({ ...value })
  },
  { deep: true }
)

onMounted(() => {
  const draft = draftStore.createRoom
  const hasDraft =
    draft.name.trim().length > 0 ||
    draft.topic.trim().length > 0 ||
    draft.avatarUrl.length > 0 ||
    draft.roomType !== 'private_room' ||
    draft.alias.length > 0 ||
    !draft.isEncrypted ||
    draft.historyVisibility !== 'shared' ||
    draft.joinRule !== 'invite'

  if (hasDraft) {
    formData.name = draft.name
    formData.topic = draft.topic
    formData.avatarUrl = draft.avatarUrl
    formData.roomType = draft.roomType
    formData.alias = draft.alias
    formData.isEncrypted = draft.isEncrypted
    formData.historyVisibility = draft.historyVisibility
    formData.joinRule = draft.joinRule
    showRestoredHint.value = true
    draftStore.setRestoredHint('createRoom')
    setTimeout(() => {
      showRestoredHint.value = false
      if (draftStore.restoredHint === 'createRoom') {
        draftStore.setRestoredHint(null)
      }
    }, RESTORED_HINT_DURATION)
  }

  void loadServerDomain()
})
</script>

<style scoped lang="scss">
.create-room-pane {
  background: var(--tjg-surface-panel);
}

.create-room-pane__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--tjg-color-primary-50);
  color: var(--tjg-color-primary-600, var(--tjg-color-primary-500));
  font-size: 12px;
  border-bottom: 1px solid var(--tjg-color-primary-100);
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
