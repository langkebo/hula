<template>
  <div class="join-room-pane flex-1 min-h-0 flex flex-col">
    <!-- 草稿恢复提示 -->
    <Transition name="hint-fade">
      <div v-if="showRestoredHint" class="join-room-pane__hint" role="status" aria-live="polite">
        <svg class="size-14px"><use href="#info"></use></svg>
        <span>{{ t('common.draft_restored', '已恢复上次编辑内容') }}</span>
      </div>
    </Transition>

    <n-scrollbar class="flex-1 min-h-0">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-placement="left"
        label-width="80"
        class="px-20px py-16px">
        <n-alert type="info" :bordered="false" class="mb-16px">
          {{ t('room.join.format_hint') }}
        </n-alert>

        <n-form-item :label="t('room.join.room_id_or_alias')" path="roomIdOrAlias">
          <n-input
            v-model:value="formData.roomIdOrAlias"
            :placeholder="t('room.join.room_id_or_alias_placeholder')"
            clearable />
        </n-form-item>

        <n-form-item :label="t('room.join.reason')" path="reason">
          <n-input
            v-model:value="formData.reason"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="t('room.join.reason_placeholder')" />
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <!-- 底部操作栏 -->
    <div
      class="join-room-pane__footer flex items-center justify-end gap-12px px-20px py-12px border-t border-[--tjg-border-layout-divider]">
      <n-button type="primary" :loading="joining" @click="handleJoin">
        {{ t('room.join.join') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { RoomTypeEnum } from '@/enums'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { useRightViewDraftStore } from '@/stores/domains/widget/rightViewDraft'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('JoinRoomPane')
const RESTORED_HINT_DURATION = 3000

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const draftStore = useRightViewDraftStore()
const formRef = ref<FormInst>()
const joining = ref(false)
const showRestoredHint = ref(false)

const formData = reactive({
  roomIdOrAlias: '',
  reason: ''
})

const rules: FormRules = {
  roomIdOrAlias: [
    { required: true, message: t('room.join.room_id_or_alias_required'), trigger: 'blur' },
    { min: 3, max: 255, message: t('room.join.room_id_or_alias_length'), trigger: 'blur' }
  ]
}

const handleJoin = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  joining.value = true
  try {
    const room = await matrixRoomActionFacade.joinRoom(formData.roomIdOrAlias)
    showFeedback(t('room.join.success'), 'success')
    // 加入成功后清除草稿
    draftStore.clearJoinRoom()
    const roomId = room?.roomId || formData.roomIdOrAlias
    // 进入房间
    await openMsgSession(roomId, RoomTypeEnum.GROUP)
    const { default: router } = await import('@/router')
    void router.back()
  } catch (error: unknown) {
    logger.error('加入房间失败:', error)
    const err = error as { errcode?: string; error?: string }
    if (err?.errcode === 'M_NOT_FOUND') {
      showFeedback(t('room.join.not_found'), 'error')
    } else if (err?.errcode === 'M_ALREADY_JOINED' || err?.error?.includes('already')) {
      showFeedback(t('room.join.already_joined'), 'warning')
    } else if (err?.errcode === 'M_FORBIDDEN') {
      showFeedback(t('room.join.forbidden'), 'error')
    } else {
      showFeedback(t('room.join.failed'), 'error')
    }
  } finally {
    joining.value = false
  }
}

// 自动同步草稿
watch(
  formData,
  (value) => {
    draftStore.saveJoinRoom({ ...value })
  },
  { deep: true }
)

onMounted(() => {
  const draft = draftStore.joinRoom
  const hasDraft = draft.roomIdOrAlias.trim().length > 0 || draft.reason.trim().length > 0

  if (hasDraft) {
    formData.roomIdOrAlias = draft.roomIdOrAlias
    formData.reason = draft.reason
    showRestoredHint.value = true
    draftStore.setRestoredHint('joinRoom')
    setTimeout(() => {
      showRestoredHint.value = false
      if (draftStore.restoredHint === 'joinRoom') {
        draftStore.setRestoredHint(null)
      }
    }, RESTORED_HINT_DURATION)
  }
})
</script>

<style scoped lang="scss">
.join-room-pane {
  background: var(--tjg-surface-panel);
}

.join-room-pane__hint {
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
