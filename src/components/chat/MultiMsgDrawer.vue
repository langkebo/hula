<template>
  <n-drawer
    v-model:show="visible"
    :width="compact ? '100%' : 450"
    placement="right"
    :trap-focus="false"
    :block-scroll="false">
    <n-drawer-content :title="t('message.merge_msg_title')" closable :native-scrollbar="false">
      <div class="multi-msg-drawer-content flex flex-col h-full">
        <n-scrollbar>
          <div v-if="loading" class="flex-center h-200px">
            <n-spin size="medium" />
          </div>
          <template v-else-if="msgs.length > 0">
            <div v-for="item in msgs" :key="item.message.id" class="py-12px mb-16px mx-10px">
              <!-- 消息头像和信息 -->
              <div class="flex cursor-default mb-4px">
                <n-avatar
                  round
                  :size="28"
                  :src="getAvatarSrc(item.fromUser.uid)"
                  class="mr-10px flex-shrink-0"
                  fallback-src="/default-avatar.png" />

                <div class="flex-y-center gap-12px h-fit">
                  <p class="text-12px color-[--tjg-text-tertiary]">
                    {{ getUserDisplayName(item.fromUser.uid, item.fromUser.username) }}
                  </p>
                  <p class="text-11px color-[--tjg-text-quaternary]">{{ formatChatTime(item.message.sendTime) }}</p>
                </div>
              </div>

              <div class="pl-38px">
                <div :class="{ bubble: !isSpecialMsgType(item.message.type) }">
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
          <n-empty v-else :description="t('chatHistory.empty.noData')" />
        </n-scrollbar>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { formatChatTime } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MultiMsgDrawer')

const props = defineProps<{
  show: boolean
  msgIds: string[]
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const userStore = useUserStore()
const groupStore = useGroupStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

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

    // Pre-fetch user info if needed
    const uids = Array.from(new Set(msgs.value.map((m: MessageType) => m.fromUser.uid)))
    await matrixContactService.getUserByIds(uids)
  } catch (error) {
    logger.error('Failed to load multi messages:', error)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (newVal: boolean) => {
    if (newVal) loadMessages()
  }
)
</script>

<style scoped lang="scss">
.multi-msg-drawer-content {
  background: var(--tjg-surface-panel);
}

.bubble {
  background: var(--tjg-surface-panel-muted);
  padding: 8px 12px;
  border-radius: 12px;
  width: fit-content;
  max-width: 100%;
  border: 1px solid var(--tjg-border-default);
  transition: background-color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--tjg-color-indigo-500) 5%, var(--tjg-surface-panel-muted));
  }
}
</style>
