<template>
  <div class="multi-msg-container">
    <!--顶部操作栏-->
    <ActionBar :shrink="false" />

    <!-- 消息列表 -->
    <n-scrollbar>
      <div v-if="loading && msgs.length === 0" class="multi-msg-status">
        <n-spin size="small" />
      </div>

      <EmptyState
        v-else-if="loadError"
        icon="mdi:alert-circle-outline"
        :title="loadError"
        :action-text="t('chat.multi_msg.retry')"
        @action="loadAll" />

      <EmptyState v-else-if="msgs.length === 0" icon="mdi:message-text-outline" :title="t('chat.multi_msg.empty')" />

      <template v-else>
        <template v-for="item in msgs" :key="item.message.id">
          <div class="py-12px mb-16px mx-20px">
            <!-- 消息头像和信息 -->
            <div class="flex cursor-default">
              <n-avatar
                :size="32"
                :src="resolveAvatarUrl(item.fromUser.uid)"
                class="rounded-10px mr-12px"
                fallback-src="/default-avatar.png" />

              <div class="flex-y-center gap-12px h-fit">
                <p class="text-(12px --tjg-text-tertiary)">{{ getUserDisplayName(item.fromUser.uid) }}</p>
                <p class="text-(12px --tjg-text-tertiary)">{{ formatChatTime(item.message.sendTime) }}</p>
              </div>
            </div>

            <ContextMenu
              :content="item"
              class="w-fit relative flex flex-col pl-44px text-(14px [--tjg-text-primary]) leading-26px select-text"
              :data-key="item.fromUser.uid === userUid ? `U${item.message.id}` : `Q${item.message.id}`"
              :special-menu="specialMenuList(item.message.type)"
              @select="$event.click(item)">
              <div
                :class="{
                  bubble: !isSpecialMsgType(item.message.type),
                  'active-reply': activeReply === item.message.id
                }"
                :data-event-id="item.message.id">
                <RenderMessage
                  :message="item"
                  :from-user="item.fromUser"
                  :is-group="true"
                  :on-image-click="handleImageClick"
                  :on-video-click="handleVideoClick"
                  :history-mode="true"
                  @jump2-reply="jumpToReply" />
              </div>
            </ContextMenu>
          </div>
        </template>
      </template>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import RenderMessage from '@/components/rightBox/renderMessage/index.vue'
import { useChatMain } from '@/composables/chat/useChatMain'
import { useReplyJump } from '@/composables/chat/useReplyJump'
import { useImageViewer } from '@/composables/common/useImageViewer'
import { useVideoViewer } from '@/composables/common/useVideoViewer'
import { useWindow } from '@/composables/common/useWindow'
import { useUserAvatar } from '@/composables/user/useUserAvatar'
import { MsgEnum } from '@/enums'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import type { UserItem } from '@/types/matrix-services'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MultiMsgWindow')
const { t } = useI18n()

type Msg = {
  msgId: string
  fromUid: string
}

const { getWindowPayload } = useWindow()
const userStore = useUserStore()
const groupStore = useGroupStore()
const { openImageViewer } = useImageViewer()
const { openVideoViewer } = useVideoViewer()
const { specialMenuList } = useChatMain(true, { disableHistoryActions: true })

const choosedMsgs = ref<Msg[]>([])
const msgs = ref<MessageType[]>([])
const users = ref<UserItem[]>([])
const loading = ref(false)
const loadError = ref('')
const route = useRoute()

// 回复气泡点击：在多选窗口自己的消息列表里定位并高亮原消息（与聊天主列表同语义）。
const { activeReply, jumpToReply } = useReplyJump({
  findIndexByEventId: (eventId) => msgs.value.findIndex((item) => item.message.id === eventId),
  resolveElement: (eventId) => document.querySelector(`[data-event-id="${eventId}"]`)
})

const userUid = computed(() => userStore.userInfo?.uid)
const { resolveAvatarUrl: resolveCachedAvatarUrl } = useUserAvatar()
const userInfoMap = computed(() => new Map(users.value.map((user) => [user.uid, user])))

// 独立窗口内群成员缓存可能尚未填充：优先群成员缓存（含当前账号头像规则），
// 缺失时用本窗口拉取的用户资料兜底，仍取不到再回落到默认头像。
const resolveAvatarUrl = (uid: string): string => {
  const cachedAvatar = groupStore.getUserInfo(uid)?.avatar
  if (cachedAvatar) {
    return resolveCachedAvatarUrl(uid)
  }
  return AvatarUtils.getAvatarUrl(userInfoMap.value.get(uid)?.avatar)
}

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

// 我的群昵称
const getUserDisplayName = computed(() => (uid: string) => {
  const user = groupStore.getUserInfo(uid)
  return user?.myName || user?.name || userInfoMap.value.get(uid)?.name || ''
})

// 获取当前页面的所有图片和表情URL
const getAllImageUrls = computed(() => {
  const imageUrls: string[] = []
  msgs.value.forEach((message) => {
    if (
      (message.message.type === MsgEnum.IMAGE || message.message.type === MsgEnum.EMOJI) &&
      message.message.body?.url
    ) {
      imageUrls.push(message.message.body.url)
    }
  })
  return imageUrls
})

// 获取当前页面的所有视频URL
const getAllVideoUrls = computed(() => {
  const videoUrls: string[] = []
  msgs.value.forEach((message) => {
    if (message.message.type === MsgEnum.VIDEO && message.message.body?.url) {
      videoUrls.push(message.message.body.url)
    }
  })
  return videoUrls
})

// 处理图片和表情点击事件
const handleImageClick = async (imageUrl: string) => {
  const imageList = getAllImageUrls.value
  await openImageViewer(imageUrl, [MsgEnum.IMAGE, MsgEnum.EMOJI], imageList)
}

// 处理视频点击事件
const handleVideoClick = async (videoUrl: string) => {
  const videoList = getAllVideoUrls.value
  const currentIndex = videoList.indexOf(videoUrl)

  if (currentIndex === -1) {
    await openVideoViewer(videoUrl, [MsgEnum.VIDEO], [videoUrl])
  } else {
    // 使用多视频模式
    await openVideoViewer(videoUrl, [MsgEnum.VIDEO], videoList)
  }
}

const getAllMsg = async () => {
  const msgIds = choosedMsgs.value.map((msg) => msg.msgId)
  try {
    const list = await matrixMessageService.getMsgListByIds({ msgIds })
    msgs.value = list as typeof list & MessageType[]
  } catch (err) {
    logger.error('Failed to load messages by ids', err)
    loadError.value = t('chat.multi_msg.load_failed')
  }
}

const getAllUserInfo = async () => {
  const uids = choosedMsgs.value.map((msg) => msg.fromUid)
  try {
    users.value = await matrixContactService.getUserByIds(uids)
  } catch (err) {
    // 用户资料只影响昵称与头像展示，失败时保留消息列表，由头像/昵称回落兜底
    logger.warn('Failed to load user profiles for multi message window', err)
  }
}

const loadAll = async () => {
  loading.value = true
  loadError.value = ''
  try {
    await getAllMsg()
    await getAllUserInfo()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
  try {
    const data = await getWindowPayload<Msg[]>(route.query.key as string)
    choosedMsgs.value = data ?? []
  } catch (e) {
    logger.error('Failed to load multi message', e)
    loadError.value = t('chat.multi_msg.load_failed')
    return
  }
  await loadAll()
})
</script>

<style scoped lang="scss">
.multi-msg-container {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-subtle);
}

.multi-msg-status {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

/* 需 !important：抵消上下文菜单注入的 .no-select */
.select-text {
  -webkit-user-select: text !important;
  user-select: text !important;
}

.bubble {
  max-width: 70vw;
  word-wrap: break-word;
}
</style>
