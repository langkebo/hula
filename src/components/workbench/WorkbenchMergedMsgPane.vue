<template>
  <div class="workbench-merged-msg-pane">
    <div class="workbench-merged-msg-pane__header">
      <span class="text-13px font-600">{{ t('message.merge_msg_title') }}</span>
      <button type="button" class="workbench-merged-msg-pane__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>

    <div class="workbench-merged-msg-pane__content">
      <n-scrollbar>
        <div v-if="loading" class="workbench-merged-msg-pane__loading">
          <n-spin size="small" />
        </div>

        <template v-else-if="msgs.length > 0">
          <div v-for="item in msgs" :key="item.message.id" class="workbench-merged-msg-pane__item">
            <div class="flex cursor-default mb-4px">
              <n-avatar
                round
                :size="24"
                :src="getAvatarSrc(item.fromUser.uid)"
                class="mr-8px flex-shrink-0"
                fallback-src="/default-avatar.png" />
              <div class="flex-y-center gap-8px h-fit">
                <p class="text-11px color-[--hula-text-tertiary]">
                  {{ getUserDisplayName(item.fromUser.uid, item.fromUser.username) }}
                </p>
                <p class="text-10px color-[--hula-text-quaternary]">{{ formatTimestamp(item.message.sendTime) }}</p>
              </div>
            </div>

            <div class="pl-32px">
              <div :class="{ 'workbench-merged-msg-pane__bubble': !isSpecialMsgType(item.message.type) }">
                <RenderMessage
                  :message="item"
                  :from-user="item.fromUser"
                  :is-group="true"
                  :on-image-click="handleImageClick"
                  :on-video-click="handleVideoClick"
                  :history-mode="true" />
              </div>
            </div>
          </div>
        </template>

        <div v-else class="workbench-merged-msg-pane__empty">
          <n-empty size="small" :description="t('chatHistory.empty.noData')" />
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RenderMessage from '@/components/rightBox/renderMessage/index.vue'
import { useImageViewer } from '@/composables/common/useImageViewer'
import { useVideoViewer } from '@/composables/common/useVideoViewer'
import { MsgEnum } from '@/enums'
import { matrixMessageAdapter } from '@/services/matrix/messaging/MatrixMessageAdapter'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WorkbenchMergedMsgPane')

const props = defineProps<{
  msgIds?: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const userStore = useUserStore()
const groupStore = useGroupStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()

const msgs = ref<MessageType[]>([])
const loading = ref(false)
const userUid = computed(() => userStore.userInfo?.uid)

const isSpecialMsgType = (type: number): boolean => {
  return (
    type === MsgEnum.IMAGE ||
    type === MsgEnum.EMOJI ||
    type === MsgEnum.NOTICE ||
    type === MsgEnum.VIDEO ||
    type === MsgEnum.FILE ||
    type === MsgEnum.MERGE
  )
}

const getUserDisplayName = (uid: string, fallbackName?: string) => {
  const user = groupStore.getUserInfo(uid)
  return user?.myName || user?.name || fallbackName || uid
}

const getAvatarSrc = (uid: string) => {
  const avatar = uid === userUid.value ? (userStore.userInfo?.avatar ?? '') : groupStore.getUserInfo(uid)?.avatar
  return AvatarUtils.getAvatarUrl(avatar as string)
}

const getAllImageUrls = computed(() => {
  return msgs.value
    .filter(
      (m: MessageType) => (m.message.type === MsgEnum.IMAGE || m.message.type === MsgEnum.EMOJI) && m.message.body?.url
    )
    .map((m: MessageType) => m.message.body.url!)
})

const getAllVideoUrls = computed(() => {
  return msgs.value
    .filter((m: MessageType) => m.message.type === MsgEnum.VIDEO && m.message.body?.url)
    .map((m: MessageType) => m.message.body.url!)
})

const handleImageClick = async (imageUrl: string) => {
  await openImageViewer(imageUrl, undefined, getAllImageUrls.value)
}

const handleVideoClick = async (videoUrl: string) => {
  await openVideoViewer(videoUrl, undefined, getAllVideoUrls.value)
}

const loadMessages = async () => {
  if (!props.msgIds || props.msgIds.length === 0) return
  loading.value = true
  try {
    const events = await matrixMessageService.getMsgListByIds({ msgIds: props.msgIds })
    msgs.value = events.map((event) =>
      matrixMessageAdapter.convertMatrixEventToMessageType(event, event.getRoomId() || '')
    )

    const uids = Array.from(new Set(msgs.value.map((m: MessageType) => m.fromUser.uid)))
    await matrixContactService.getUserByIds(uids)
  } catch (error) {
    logger.error('Failed to load merged messages:', error)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.msgIds,
  (newIds) => {
    if (newIds && newIds.length > 0) {
      loadMessages()
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.workbench-merged-msg-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.workbench-merged-msg-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.workbench-merged-msg-pane__close {
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

.workbench-merged-msg-pane__content {
  flex: 1;
  min-height: 0;
}

.workbench-merged-msg-pane__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.workbench-merged-msg-pane__item {
  margin-bottom: 12px;
}

.workbench-merged-msg-pane__bubble {
  background: var(--hula-surface-panel-muted);
  padding: 6px 10px;
  border-radius: 10px;
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--hula-border-default);
  transition: background-color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--hula-color-primary-500) 5%, var(--hula-surface-panel-muted));
  }
}

.workbench-merged-msg-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}
</style>
