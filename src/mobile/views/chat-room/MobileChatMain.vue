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
      <div @click="handleChatMainClick" class="h-full overflow-y-auto">
        <ChatMain @scroll="handleScroll" />
      </div>
    </template>
    <template #footer>
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
import MobileBatchToolbar from '#/components/chat-room/MobileBatchToolbar.vue'
import PrivateModeConfirmDialog from '#/components/chat-room/PrivateModeConfirmDialog.vue'
import LocationShare from '#/views/chat-room/LocationShare.vue'
import MobileForwardDialog from '#/views/chat-room/MobileForwardDialog.vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, RoomTypeEnum } from '@/enums'
import router from '@/router'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { extractServerName } from '@/utils/userIdentity'

const logger = createLogger('MobileChatMain')

defineOptions({
  name: 'mobileChatRoomDefault'
})

const globalStore = useGlobalStore()
const chatStore = useChatStore()
const { currentSession } = storeToRefs(globalStore)
const globalUnreadCount = computed(() => globalStore.messageUnreadCount ?? 0)

// 联邦判定（与 ChatHeaderRoot 单一事实源一致）
const currentSessionRoomId = computed(() => globalStore.currentSessionRoomId)
const federationServer = computed(() => extractServerName(currentSessionRoomId.value))
const isFederated = computed(() => {
  const roomServer = federationServer.value
  const localServer = extractServerName(matrixClientService.getUserId())
  return Boolean(roomServer) && roomServer !== localServer
})

const props = defineProps<{
  uid?: ''
}>()

const isGroupSession = computed(() => currentSession.value?.type === RoomTypeEnum.GROUP)

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

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

const handleChatMainClick = () => {
  // 移动端点击聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleScroll = () => {
  // 移动端滚动聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleRoomNameClick = () => {
  if (props.uid) {
    router.push(`/mobile/mobileFriends/friendInfo/${props.uid}`)
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
</style>
