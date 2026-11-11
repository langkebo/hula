<template>
  <AutoFixHeightPage>
    <template #header>
      <HeaderBar
        ref="headerBar"
        :room-name="currentSession?.remark || currentSession?.name || ''"
        :msg-count="globalUnreadCount"
        :is-official="globalStore.currentSessionRoomId === '1'"
        :is-group="isGroupSession"
        :private-mode-active="privateModeActive"
        :federation-server="isFederated ? federationServer : ''"
        :room-server="federationServer"
        @room-name-click="handleRoomNameClick"
        @toggle-private-mode="onTogglePrivateMode" />
    </template>
    <template #container>
      <div v-clickable @click="handleChatMainClick" class="h-full overflow-y-auto">
        <ChatMain @scroll="handleScroll" />
      </div>
    </template>
    <template #footer>
      <RoomEncryptionBanner :warnings="roomEncryptionWarnings" />
      <MobileBatchToolbar v-if="chatStore.isMsgMultiChoose" @forward="handleBatchForward" @exit="handleBatchExit" />
      <FooterBar v-else @location="handleLocationClick" />
    </template>

    <!-- 移动端快捷表情回应面板 -->
    <MobileReactionPicker
      v-model:visible="showReactionPicker"
      :room-id="reactionRoomId"
      :event-id="reactionEventId"
      @reacted="handleReacted" />

    <!-- 移动端位置共享面板 -->
    <LocationShare
      :show="showLocationShare"
      :room-id="globalStore.currentSessionRoomId"
      @update:show="showLocationShare = $event" />

    <!-- 移动端转发对话框 -->
    <MobileForwardDialog
      v-model:visible="showForwardDialog"
      :event-id="reactionEventId"
      :room-id="reactionRoomId"
      :event-ids="forwardEventIds" />

    <!-- 移动端私密模式确认对话框（van-dialog） -->
    <PrivateModeConfirmDialog
      v-model:show="showPrivateConfirm"
      @confirm="onConfirmPrivateMode"
      @cancel="onCancelPrivateMode" />
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import MobileBatchToolbar from '#/components/chat-room/MobileBatchToolbar.vue'
import PrivateModeConfirmDialog from '#/components/chat-room/PrivateModeConfirmDialog.vue'
import LocationShare from '#/views/chat-room/LocationShare.vue'
import MobileForwardDialog from '#/views/chat-room/MobileForwardDialog.vue'
import RoomEncryptionBanner from '@/components/encryption/RoomEncryptionBanner.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useRoomEncryptionStatus } from '@/composables/encryption/useRoomEncryptionStatus'
import { MittEnum, RoomTypeEnum } from '@/enums'
import router from '@/router'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useChatSession } from '@/shared/composables/useChatSession'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { extractServerName } from '@/utils/userIdentity'

const logger = createLogger('MobileChatMain')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

defineOptions({
  name: 'mobileChatRoomDefault'
})

const globalStore = useGlobalStore()
const chatStore = useChatStore()
// 只取 switchSession（写当前会话 / 标已读 / 同步群成员）。
// 不要在这里引 `useMessage()`：它会把矩阵客户端初始化链路拖进 setup，
// 组件测试与首屏都因此变慢（实测单测从 1s 涨到 52s）。
const { switchSession } = useChatSession()
const { currentSession } = storeToRefs(globalStore)
const globalUnreadCount = computed(() => globalStore.messageUnreadCount ?? 0)

// 联邦判定（与 ChatHeaderRoot 单一事实源一致）
const currentSessionRoomId = computed(() => globalStore.currentSessionRoomId)
const { warnings: roomEncryptionWarnings } = useRoomEncryptionStatus(currentSessionRoomId)
const federationServer = computed(() => extractServerName(currentSessionRoomId.value))
const isFederated = computed(() => {
  const roomServer = federationServer.value
  const localServer = extractServerName(matrixClientService.getUserId())
  return Boolean(roomServer) && roomServer !== localServer
})

const props = defineProps<{
  /** 路由参数：房间号（`!xxx:server`）。旧链接可能是对端 uid，见 `resolveRoomId`。 */
  roomId?: string
}>()

const isGroupSession = computed(() => currentSession.value?.type === RoomTypeEnum.GROUP)

/**
 * 解析路由参数到房间号。
 *
 * 正常情况直接就是 roomId；历史推送/收藏里的旧深链带的是对端 uid（`@peer:server`），
 * 这时按 session.detailId/account 反查一次，避免旧链接 404 到空聊天页。
 */
const resolveRoomId = (raw?: string): string | null => {
  const value = raw?.trim()
  if (!value) return null
  if (value.startsWith('!')) return value
  const matched = chatStore.sessionList.find((item) => item.detailId === value || item.account === value)
  return matched?.roomId ?? null
}

/**
 * 打开路由指定的会话（深链 / 刷新 / 进程重建的唯一入口）。
 *
 * 此前移动端进会话完全靠列表页把 `currentSessionRoomId` 写进内存，路由参数形同虚设：
 * 刷新或系统回收后落在 `/mobile/chatRoom/chatMain`，房间丢了就是空白聊天页。
 */
const openRoomFromRoute = async (raw?: string) => {
  const roomId = resolveRoomId(raw)
  if (!roomId) return

  let session = chatStore.getSession(roomId)
  if (!session) {
    // 冷启动深链：会话列表还没拉过（列表页不在路由栈上），先补一次。
    // 失败不能静默：用户会停在空白聊天页，必须给出「加载失败」的可见反馈。
    try {
      await chatStore.getSessionList(true)
    } catch (error) {
      logger.error('Failed to load session list for deep link:', roomId, error)
      showFeedback(t('mobile_chat.session_load_failed'), 'warning')
    }
    session = chatStore.getSession(roomId)
  }
  if (!session) {
    logger.warn('route session not found, falling back to message list:', roomId, raw)
    await router.replace('/mobile/message')
    return
  }
  // 与列表点击同一套语义：写当前会话 + 标已读 + 同步群成员
  await switchSession(session)
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
  void openRoomFromRoute(props.roomId)
})

watch(
  () => props.roomId,
  (next) => {
    void openRoomFromRoute(next)
  }
)

onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

const privateModeActive = ref(false)
const showPrivateConfirm = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}
const onTogglePrivateMode = () => {
  if (privateModeActive.value) {
    // 已激活，直接退出（ChatMain.togglePrivateMode 走已激活分支）
    useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, { confirmed: false })
  } else {
    // 未激活，显示移动端确认对话框（van-dialog）
    showPrivateConfirm.value = true
  }
}
const onConfirmPrivateMode = () => {
  showPrivateConfirm.value = false
  // 用户已确认，ChatMain 直接调用 confirmPrivateMode 进入私密模式，不弹 PC 对话框
  useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, { confirmed: true })
}
const onCancelPrivateMode = () => {
  showPrivateConfirm.value = false
}

const handleChatMainClick = () => {
  // 移动端点击聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleScroll = () => {
  // 移动端滚动聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

/**
 * 点标题栏进好友详情：身份从**当前会话**的 `detailId` 取，不再依赖路由参数。
 *
 * 路由参数现在是房间号（群聊没有对端 uid），沿用旧写法会把 roomId 拼进
 * `/friendInfo/:uid` 得到 404。群聊不跳（成员详情走成员列表）。
 */
const handleRoomNameClick = () => {
  if (isGroupSession.value) return
  const peerId = currentSession.value?.detailId
  if (peerId) {
    router.push(`/mobile/mobileFriends/friendInfo/${peerId}`)
  }
}

// ── 消息操作面板 & 快捷表情回应 ──────────────────────────

/** 快捷表情回应面板 */
const showReactionPicker = ref(false)
const reactionEventId = ref('')
const reactionRoomId = ref('')

/** 位置共享面板 */
const showLocationShare = ref(false)

/** 转发对话框 */
const showForwardDialog = ref(false)
/** 批量转发的 eventId 列表(单条转发时为空数组) */
const forwardEventIds = ref<string[]>([])

/** 子级组件（如 renderMessage/ContextMenu）通过 mitt 等通道直接触发各面板 */

const handleReacted = (emoji: string) => {
  logger.info('Reaction added:', emoji)
  showReactionPicker.value = false
  // 清理状态
  reactionEventId.value = ''
  reactionRoomId.value = ''
}

/** 位置共享点击处理 */
const handleLocationClick = () => {
  showLocationShare.value = true
}

/**
 * 多选模式下的转发处理
 * MobileBatchToolbar 触发 forward 事件时,设置当前源事件并打开转发对话框
 * (此时多选模式已由 toolbar 内部 exitMultiSelect 退出)
 *
 * payload.eventIds 长度为多选条数;为兼容单条链路,保持 reactionEventId 作为首条 eventId
 */
const handleBatchForward = (payload: { eventId: string; roomId: string; eventIds: string[] }): void => {
  reactionEventId.value = payload.eventId
  reactionRoomId.value = payload.roomId
  forwardEventIds.value = payload.eventIds
  showForwardDialog.value = true
}

/** 多选模式退出处理 */
const handleBatchExit = (): void => {
  // chat store 的 isMsgMultiChoose 已由 toolbar 内部清空
  // 此处仅记录日志,后续如需清理其他状态可在此扩展
  logger.info('[MobileChatMain] Exit multi-select mode')
}
</script>

<style lang="scss">
@use '@/styles/scss/render-message';

/**
 * 移动端聊天室微信式视觉微调（仅本页 chunk 加载，不影响桌面）。
 * 只做"收紧留白 + 压平气泡"，颜色与圆角仍走设计 token。
 */
#image-chat-main .message-row {
  /* 桌面行首 20px 是为头像留白，移动端左右对称更接近微信 */
  padding: 5px 12px;
}

#image-chat-main .bubble,
#image-chat-main .bubble-oneself {
  box-shadow: none;
}

/* 保留用户的"方形气泡"外观设置，不覆盖其圆角 */
html:not([data-bubble-style='square']) #image-chat-main .bubble {
  border-radius: 2px 10px 10px 10px;
}

html:not([data-bubble-style='square']) #image-chat-main .bubble-oneself {
  border-radius: 10px 2px 10px 10px;
}

/* 微信输入框没有聚焦高亮外框，聚焦反馈体现在光标与文字上 */
#message-form:focus-within .n-scrollbar.n-scrollbar {
  border-color: transparent;
}

/* 微信式输入框：浅灰圆角底 + 舒适内边距，覆盖桌面态的透明背景与 4px 内边距 */
#message-form #message-input {
  background: var(--tjg-surface-subtle);
  border-radius: 8px;
  padding: 8px 12px;
  max-height: 8rem;
  overflow-y: auto;
}

/* 占位符：UnoCSS 的 empty 变体在移动端未命中，这里显式声明 */
#message-form #message-input:empty::before {
  content: attr(data-placeholder);
  color: var(--tjg-text-tertiary);
}
</style>
