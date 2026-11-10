<template>
  <div class="msg-input-container">
    <!-- 位置选择弹窗 -->
    <LocationModal v-model:show="showLocationModal" @location-selected="handleLocationSelected" />

    <!-- 录音模式 -->
    <VoiceRecorder v-show="isVoiceMode" @cancel="handleVoiceCancel" @send="sendVoiceDirect" />

    <!-- 回复预览条（原型对齐项 #3：替换原内联 #replyDiv） -->
    <ReplyComposer v-if="replyToInfo" :reply-to="replyToInfo" @cancel="clearReply" />

    <!-- 输入框表单 -->
    <form
      v-show="!isVoiceMode"
      id="message-form"
      @submit.prevent="handleFormSubmit"
      :class="formClass"
      class="w-full flex flex-1 min-h-0">
      <div class="w-full flex" :class="containerClass">
        <!-- 移动端语音按钮（输入框左侧，顺序对齐微信） -->
        <div v-if="isMobileRef" class="flex items-center justify-center w-6 ms-5px h-2.5rem">
          <svg
            @click="handleVoiceClick"
            :class="isVoicePanelActive ? 'text-[--tjg-color-primary-500]' : ''"
            class="w-25px h-25px mt-2px outline-none">
            <use href="#voice"></use>
          </svg>
        </div>

        <ContextMenu class="w-full flex-1 min-h-0" @select="$event.click()" :menu="menuList">
          <n-scrollbar @click="focusInput">
            <div
              id="message-input"
              ref="messageInputDom"
              role="textbox"
              aria-multiline="true"
              :aria-label="t('editor.placeholder')"
              :style="{ minHeight: inputMinHeight, lineHeight: inputLineHeight, outline: 'none' }"
              contenteditable
              spellcheck="false"
              @paste="onPaste($event)"
              @input="handleInternalInput"
              @keydown.exact.enter="handleEnterKey"
              @keydown.exact.meta.enter="handleEnterKey"
              @keydown="updateSelectionRange"
              @keyup="updateSelectionRange"
              @click="updateSelectionRange"
              @blur="handleBlur"
              @compositionend="updateSelectionRange"
              @keydown.exact.ctrl.enter="handleEnterKey"
              :data-placeholder="t('editor.placeholder')"
              class="n-input"
              :class="inputClass"></div>
          </n-scrollbar>
        </ContextMenu>

        <!-- 移动端表情/发送操作栏（位于输入框右侧，顺序对齐微信） -->
        <MsgInputMobileControls
          v-if="isMobileRef"
          :mobile-panel-state="mobilePanelState"
          :has-input="msgInput"
          :disabled-send="disabledSend"
          :isAIMode="props.isAIMode"
          :isAIStreaming="props.isAIStreaming"
          @handle-emoji-click="handleEmojiClick"
          @handle-more-click="handleMoreClick"
          @handle-mobile-send="handleMobileSend" />

        <!-- 桌面端工具栏 + 发送按钮 -->
        <MsgInputToolbar
          v-if="!isMobileRef"
          v-model:arrow="arrow"
          v-model:chat-key="chatKey"
          :disabled-send="disabledSend"
          :isAIMode="props.isAIMode"
          :isAIStreaming="props.isAIStreaming"
          :is-sharing="sharing"
          :delayed-supported="delayedSupported"
          :send-options="sendOptions"
          @show-location-modal="showLocationModal = true"
          @handle-beacon-click="handleBeaconClick"
          @handle-file-upload-click="handleFileUploadClick"
          @handle-desktop-send="handleDesktopSend"
          @open-delayed-modal="openDelayedModal" />

        <!-- @提及框 -->
        <MsgInputMentionPanel
          ref="aitPanelRef"
          :visible="ait && activeItem?.type === RoomTypeEnum.GROUP && personList.length > 0"
          :items="personList"
          v-model:selectedKey="selectedAitKey"
          @select="handleAit" />

        <!-- / 提及框 -->
        <MsgInputAICommandPanel
          ref="aiPanelRef"
          :visible="aiDialogVisible && activeItem?.type === RoomTypeEnum.GROUP && groupedAIModels.length > 0"
          :items="groupedAIModels"
          v-model:selectedKey="selectedAIKey"
          @select="handleAI()" />
      </div>
    </form>

    <!-- 文件上传弹窗 -->
    <FileUploadModal
      v-model:show="showFileModal"
      :files="pendingFiles"
      @confirm="handleFileConfirm"
      @cancel="handleFileCancel" />

    <!-- 定时消息：定时入口与待发列表 -->
    <DelayedMessagesModal
      v-if="delayedSupported"
      v-model:show="showDelayedModal"
      :items="delayedItems"
      :loading="delayedLoading"
      :draft-available="!disabledSend"
      :room-names="delayedRoomNames"
      @schedule="handleScheduleDelayed"
      @cancel="cancelDelayed"
      @send-now="sendDelayedNow"
      @reschedule="rescheduleDelayed"
      @refresh="refreshDelayed" />
  </div>
</template>

<script setup lang="ts">
import type { VirtualListInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import DelayedMessagesModal from '@/components/rightBox/DelayedMessagesModal.vue'
import type { ReplyToInfo } from '@/components/rightBox/ReplyComposer.vue'
import ReplyComposer from '@/components/rightBox/ReplyComposer.vue'
import { useDelayedMessageEntry } from '@/composables/chat/useDelayedMessageEntry'
import { useMsgInput } from '@/composables/chat/useMsgInput'
import { useMsgInputLocationShare } from '@/composables/chat/useMsgInputLocationShare'
import { useMsgInputMobilePanels } from '@/composables/chat/useMsgInputMobilePanels'
import { useMsgInputSendEntry } from '@/composables/chat/useMsgInputSendEntry'
import { useMsgInputSuggestionNav } from '@/composables/chat/useMsgInputSuggestionNav'
import { useMsgInputUploadEntry } from '@/composables/chat/useMsgInputUploadEntry'
import { useMitt } from '@/composables/common/useMitt'
import { useSendOptions } from '@/composables/settings/settingsOptions'
import { MittEnum, type MobilePanelStateEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import type { UserItem } from '@/services/types.ts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import MsgInputMobileControls from './MsgInputMobileControls.vue'
import MsgInputToolbar from './MsgInputToolbar.vue'
import MsgInputAICommandPanel from './msg-input/MsgInputAICommandPanel.vue'
import MsgInputMentionPanel from './msg-input/MsgInputMentionPanel.vue'

// 异步加载重型组件
const LocationModal = defineAsyncComponent(() => import('./location/LocationModal.vue'))
const VoiceRecorder = defineAsyncComponent(() => import('./VoiceRecorder.vue'))
const FileUploadModal = defineAsyncComponent(() => import('./FileUploadModal.vue'))

interface Props {
  isAIMode?: boolean
  isAIStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isAIMode: false,
  isAIStreaming: false
})

interface ClickState {
  panelState: MobilePanelStateEnum
}

interface AISendData {
  content: string
}

const selfEmitter = defineEmits<{
  (e: 'clickMore', data: ClickState): void
  (e: 'clickEmoji', data: ClickState): void
  (e: 'clickVoice', data: ClickState): void
  (e: 'customFocus', data: ClickState): void
  (e: 'send', data: ClickState): void
  (e: 'input', event: Event): void
  (e: 'send-ai', data: AISendData): void
  (e: 'stop-ai'): void
}>()

const { t } = useI18n()
const sendOptions = useSendOptions()
const arrow = ref(false)
const messageInputDom = ref<HTMLElement>()
const gloabalStore = useGlobalStore()
const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(gloabalStore)
const groupStore = useGroupStore()

const {
  inputKeyDown,
  handleAit,
  handleAI,
  handleInput,
  msgInput,
  send,
  sendLocationDirect,
  sendFilesDirect,
  sendVoiceDirect,
  sendEmojiDirect,
  sendLinkPreviewDirect,
  personList,
  disabledSend,
  ait,
  aiDialogVisible,
  selectedAIKey,
  chatKey,
  menuList,
  selectedAitKey,
  groupedAIModels,
  updateSelectionRange,
  focusOn,
  getCursorSelectionRange,
  reply,
  scheduleDelayedMessage,
  delayedMessages
} = useMsgInput(messageInputDom)

// ===== 私有模式（接收外部状态广播）=====
const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

// ===== 移动端面板状态 / 语音模式 / 输入区样式 =====
const {
  isMobileRef,
  isVoiceMode,
  mobilePanelState,
  isVoicePanelActive,
  formClass,
  containerClass,
  inputMinHeight,
  inputLineHeight,
  inputClass,
  setIsFocus,
  handleMoreClick,
  handleEmojiClick,
  handleVoiceClick,
  handleVoiceCancel
} = useMsgInputMobilePanels({
  msgInput,
  privateModeActive,
  emitCustomFocus: (panelState) => selfEmitter('customFocus', { panelState }),
  emitClickMore: (panelState) => selfEmitter('clickMore', { panelState }),
  emitClickEmoji: (panelState) => selfEmitter('clickEmoji', { panelState }),
  emitClickVoice: (panelState) => selfEmitter('clickVoice', { panelState })
})

// ===== @ 提及 / 指令候选面板 =====
const aitPanelRef = useTemplateRef<{ virtualList: VirtualListInst | undefined }>('aitPanelRef')
const aiPanelRef = useTemplateRef<{ virtualList: VirtualListInst | undefined }>('aiPanelRef')
const virtualListInstAit = computed(() => aitPanelRef.value?.virtualList)
const virtualListInstAI = computed(() => aiPanelRef.value?.virtualList)

useMsgInputSuggestionNav({
  ait,
  aiDialogVisible,
  personList,
  groupedAIModels,
  selectedAitKey,
  selectedAIKey,
  virtualListInstAit,
  virtualListInstAI,
  handleAit
})

// ===== 文件入口 / 位置能力 / 发送入口 =====
const {
  showFileModal,
  pendingFiles,
  showFileModalCallback,
  handleFileUploadClick,
  handleGlobalFilesDrop,
  onPaste,
  handleFileConfirm,
  handleFileCancel
} = useMsgInputUploadEntry({ messageInputDom, sendFilesDirect })

const { sharing, showLocationModal, handleBeaconClick, handleLocationSelected } = useMsgInputLocationShare({
  currentSessionRoomId,
  sendLocationDirect
})

const { handleFormSubmit, handleInternalInput, handleAISend, handleMobileSend, handleDesktopSend, handleEnterKey } =
  useMsgInputSendEntry({
    messageInputDom,
    currentSessionRoomId,
    isAIMode: () => props.isAIMode,
    isAIStreaming: () => props.isAIStreaming,
    send,
    inputKeyDown,
    handleInput,
    emitInput: (e) => selfEmitter('input', e),
    emitSendAi: (content) => selfEmitter('send-ai', { content }),
    emitStopAi: () => selfEmitter('stop-ai')
  })

// ===== 定时消息（MSC4140）=====
const {
  showDelayedModal,
  delayedSupported,
  delayedItems,
  delayedLoading,
  delayedRoomNames,
  openDelayedModal,
  handleScheduleDelayed,
  cancelDelayed,
  sendDelayedNow,
  rescheduleDelayed,
  refreshDelayed
} = useDelayedMessageEntry({ roomId: currentSessionRoomId, delayedMessages, scheduleDelayedMessage })

// 原型对齐项 #3：回复预览条改用 ReplyComposer.vue（绑定 reply ref），替换原内联 #replyDiv DOM 注入
const replyToInfo = computed<ReplyToInfo | null>(() => {
  const r = reply.value
  if (!r.key) return null
  return {
    eventId: String(r.key),
    senderId: '',
    senderName: r.accountName,
    senderAvatar: r.avatar,
    msgType: MsgEnum.TEXT,
    contentPreview: r.content,
    thumbnailUrl: ''
  }
})

const clearReply = () => {
  reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }
}

const focusInput = () => {
  if (messageInputDom.value) {
    focusOn(messageInputDom.value)
    setIsFocus(true)
  }
}

const handleBlur = () => {
  setIsFocus(false)
}

watch(activeItem, () => {
  nextTick(() => {
    if (!isMobileRef.value) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
})

defineExpose({
  messageInputDom,
  updateSelectionRange,
  focus: () => focusInput(),
  getLastEditRange: () => getCursorSelectionRange(),
  showFileModal: showFileModalCallback,
  isVoiceMode: readonly(isVoiceMode),
  handleVoiceCancel,
  sendVoiceDirect,
  sendFilesDirect,
  sendEmojiDirect,
  sendLinkPreviewDirect,
  handleLocationSelected,
  handleGlobalFilesDrop,
  handleAISend
})

// F-1 修复：async onMounted 中注册的 mitt handler（getCurrentInstance 已失效，不自动清理），
// 收集其 cleanup 函数，onUnmounted 统一清理，避免重复响应与内存增长。
const mittCleanups: Array<() => void> = []

onMounted(() => {
  nextTick(() => {
    if (!isMobileRef.value) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
  mittCleanups.push(
    useMitt.on(MittEnum.AT, (event: string | { user: UserItem }) => {
      if (typeof event === 'object' && event.user) {
        handleAit(event.user)
      } else {
        const userInfo = groupStore.getUserInfo(event as string)
        if (userInfo) handleAit(userInfo)
      }
    })
  )
})

onUnmounted(() => {
  mittCleanups.forEach((cleanup) => cleanup())
  mittCleanups.length = 0
})

watch(
  () => props.isAIMode,
  (newValue) => {
    if (!newValue) selectedAIKey.value = null
  }
)
</script>

<style scoped lang="scss">
@use '@/styles/scss/msg-input';
.msg-input-container {
  display: contents;
}
.private-mode-input {
  border: 1px dashed var(--tjg-color-danger-500);
}
</style>
