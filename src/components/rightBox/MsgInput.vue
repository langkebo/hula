<template>
  <div class="msg-input-container">
    <!-- 位置选择弹窗 -->
    <LocationModal v-model:visible="showLocationModal" @location-selected="handleLocationSelected" />

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
        <!-- 移动端控件（语音按钮 + 底部操作栏） -->
        <MsgInputMobileControls
          v-if="isMobileRef"
          :mobile-panel-state="mobilePanelState"
          :has-input="msgInput"
          :disabled-send="disabledSend"
          :isAIMode="props.isAIMode"
          :isAIStreaming="props.isAIStreaming"
          @handle-voice-click="handleVoiceClick"
          @handle-emoji-click="handleEmojiClick"
          @handle-more-click="handleMoreClick"
          @handle-mobile-send="handleMobileSend" />

        <ContextMenu class="w-full flex-1 min-h-0" @select="$event.click()" :menu="menuList">
          <n-scrollbar @click="focusInput">
            <div
              id="message-input"
              ref="messageInputDom"
              :style="{
                minHeight: inputMinHeight,
                lineHeight: inputLineHeight,
                outline: 'none'
              }"
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

        <!-- 桌面端工具栏 + 发送按钮 -->
        <MsgInputToolbar
          v-if="!isMobileRef"
          v-model:arrow="arrow"
          v-model:chat-key="chatKey"
          :disabled-send="disabledSend"
          :isAIMode="props.isAIMode"
          :isAIStreaming="props.isAIStreaming"
          :is-sharing="sharing"
          :send-options="sendOptions"
          @show-location-modal="showLocationModal = true"
          @handle-beacon-click="handleBeaconClick"
          @handle-file-upload-click="handleFileUploadClick"
          @handle-desktop-send="handleDesktopSend" />

        <!-- @提及框 -->
        <div v-if="ait && activeItem?.type === RoomTypeEnum.GROUP && personList.length > 0" class="ait-options">
          <n-virtual-list
            id="image-chat-ait"
            ref="virtualListInst-ait"
            style="max-height: 180px"
            :item-size="36"
            :items="personList"
            v-model:selectedKey="selectedAitKey">
            <template #default="{ item }">
              <n-flex
                @mouseover="() => (selectedAitKey = item.uid)"
                :class="{ active: selectedAitKey === item.uid }"
                @click="handleAit(item)"
                :key="item.uid"
                align="center"
                class="ait-item">
                <n-avatar
                  lazy
                  round
                  :size="22"
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  color="var(--tjg-surface-panel)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  :render-placeholder="() => null"
                  :intersection-observer-options="{
                    root: '#image-chat-ait'
                  }" />
                <span>{{ item.myName || item.name }}</span>
              </n-flex>
            </template>
          </n-virtual-list>
        </div>

        <!-- / 提及框 -->
        <div
          v-if="aiDialogVisible && activeItem?.type === RoomTypeEnum.GROUP && groupedAIModels.length > 0"
          class="AI-options">
          <n-virtual-list
            ref="virtualListInst-AI"
            style="max-height: 180px"
            :item-size="36"
            :items="groupedAIModels"
            v-model:selectedKey="selectedAIKey">
            <template #default="{ item }">
              <n-flex
                @mouseover="() => (selectedAIKey = item.uid)"
                :class="{ active: selectedAIKey === item.uid }"
                @click="handleAI(item)"
                align="center"
                class="AI-item">
                <n-flex align="center" justify="space-between" class="w-full pr-6px">
                  <n-flex align="center">
                    <img class="size-18px object-contain" :src="item.avatar" :alt="item.name + '的头像'" />
                    <p class="text-(14px [--tjg-text-primary])">{{ item.name }}</p>
                  </n-flex>

                  <n-flex align="center" :size="6">
                    <div
                      class="ml-6px p-[4px_8px] size-fit bg-[--tjg-color-beta-100] rounded-6px text-(11px [--tjg-color-beta-500] center)">
                      Beta
                    </div>
                    <n-tag size="small" class="text-[length:var(--tjg-font-size-xs)]" :bordered="false" type="success">
                      128k
                    </n-tag>
                  </n-flex>
                </n-flex>
              </n-flex>
            </template>
          </n-virtual-list>
        </div>
      </div>
    </form>

    <!-- 文件上传弹窗 -->
    <FileUploadModal
      v-model:show="showFileModal"
      :files="pendingFiles"
      @confirm="handleFileConfirm"
      @cancel="handleFileCancel" />
  </div>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onKeyStroke } from '@vueuse/core'
import type { VirtualListInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ReplyToInfo } from '@/components/rightBox/ReplyComposer.vue'
import ReplyComposer from '@/components/rightBox/ReplyComposer.vue'
import { useMsgInput } from '@/composables/chat/useMsgInput'
import { useTyping } from '@/composables/chat/useTyping'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useCommon } from '@/composables/common/useCommon'
import { useMitt } from '@/composables/common/useMitt'
import { useSendOptions } from '@/composables/settings/settingsOptions'
import { MittEnum, MobilePanelStateEnum, MsgEnum, RoomTypeEnum, ThemeEnum } from '@/enums'
import type { AIModel, UserItem } from '@/services/types.ts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useLocationStore } from '@/stores/domains/chat/location'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import type { LocationData } from '@/types/common'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { UploadFile } from '@/utils/FileType'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import MsgInputMobileControls from './MsgInputMobileControls.vue'
import MsgInputToolbar from './MsgInputToolbar.vue'

// 异步加载重型组件
const LocationModal = defineAsyncComponent(() => import('./location/LocationModal.vue'))
const VoiceRecorder = defineAsyncComponent(() => import('./VoiceRecorder.vue'))
const FileUploadModal = defineAsyncComponent(() => import('./FileUploadModal.vue'))

const logger = createLogger('MsgInput')

interface Props {
  isAIMode?: boolean
  isAIStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isAIMode: false,
  isAIStreaming: false
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const settingStore = useSettingStore()
const { handlePaste, processFiles } = useCommon()
const sendOptions = useSendOptions()
const arrow = ref(false)
const messageInputDom = ref<HTMLElement>()
const gloabalStore = useGlobalStore()
const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(gloabalStore)
const virtualListInstAit = useTemplateRef<VirtualListInst>('virtualListInst-ait')
const virtualListInstAI = useTemplateRef<VirtualListInst>('virtualListInst-AI')
const isVoiceMode = ref(false)
const groupStore = useGroupStore()
const locationStore = useLocationStore()
const { sharing } = storeToRefs(locationStore)

const showFileModal = ref(false)
const pendingFiles = ref<UploadFile[]>([])
const showLocationModal = ref(false)
const privateModeActive = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}

// ===== 移动端检测（消除模板内 isMobile() 调用） =====
const isMobileRef = computed(() => isMobile())

const formClass = computed(() => (isMobileRef.value ? 'gap-10px ' : ''))
const containerClass = computed(() =>
  isMobileRef.value ? 'flex flex-1 p-5px gap-2 pt-5px items-center min-h-2.25rem' : ' flex-col'
)
const inputMinHeight = computed(() => (isMobileRef.value ? '2rem' : '36px'))
const inputLineHeight = computed(() => (isMobileRef.value && !msgInput.value ? '2rem' : '20px'))
const inputClass = computed(() => {
  const base = isMobileRef.value
    ? 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2 min-h-2rem ps-10px! text-[length:var(--tjg-font-size-base)]! rounded-10px! max-h-8rem! flex items-center'
    : 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2'
  return privateModeActive.value ? `${base} private-mode-input` : base
})

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
  reply
} = useMsgInput(messageInputDom)

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

const { startTyping, stopTyping } = useTyping()

const handleFormSubmit = async (e: Event) => {
  e.preventDefault()
  if (currentSessionRoomId.value && isTyping.value) {
    isTyping.value = false
    if (typingTimeout.value) clearTimeout(typingTimeout.value)
    stopTyping(currentSessionRoomId.value)
  }
  await send()
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

watch(personList, (newList) => {
  if (newList.length > 0) {
    virtualListInstAit.value?.scrollTo({ key: newList[0].uid })
    selectedAitKey.value = newList[0].uid
  } else {
    ait.value = false
  }
})

const typingTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const isTyping = ref(false)

const handleInternalInput = (e: Event) => {
  handleInput(e)
  selfEmitter('input', e)

  if (currentSessionRoomId.value && !isTyping.value) {
    isTyping.value = true
    startTyping(currentSessionRoomId.value, 30000)
  }

  if (typingTimeout.value) clearTimeout(typingTimeout.value)

  typingTimeout.value = setTimeout(() => {
    if (currentSessionRoomId.value && isTyping.value) {
      isTyping.value = false
      stopTyping(currentSessionRoomId.value)
    }
  }, 3000)
}

const showFileModalCallback = (files: UploadFile[]) => {
  pendingFiles.value = files
  showFileModal.value = true
}

const handleBeaconClick = async () => {
  if (!currentSessionRoomId.value) return

  // 已在共享中：再次点击工具栏按钮即「停止共享」
  if (sharing.value) {
    await stopSharing()
    return
  }

  try {
    await locationStore.startLiveShare(currentSessionRoomId.value, '实时位置共享')
    showFeedback(t('message.beacon.started') || '信标已启动', 'success')
  } catch (error) {
    logger.error('启动 Beacon 失败:', error)
    showFeedback(t('message.beacon.failed') || '信标启动失败', 'error')
  }
}

const stopSharing = async () => {
  const liveBeaconId = Array.from(locationStore.activeBeacons.entries()).find(([, beacon]) => beacon.isLive)?.[0]
  if (!liveBeaconId) return

  try {
    await locationStore.stopLiveShare(liveBeaconId)
    showFeedback('已停止共享', 'success')
  } catch (error) {
    logger.error('停止 Beacon 失败:', error)
    showFeedback('停止共享失败', 'error')
  }
}

const handleFileUploadClick = () => {
  showFileModalCallback([])
}

const onPaste = async (e: ClipboardEvent) => {
  if (messageInputDom.value) await handlePaste(e, messageInputDom.value, showFileModalCallback)
}

const handleFileConfirm = async (files: UploadFile[]) => {
  try {
    await sendFilesDirect(files)
  } catch (error) {
    logger.error('弹窗发送文件失败:', error)
  }
  showFileModal.value = false
  pendingFiles.value = []
}

const handleFileCancel = () => {
  showFileModal.value = false
  pendingFiles.value = []
}

const handleGlobalFilesDrop = async (files: UploadFile[]) => {
  if (!files?.length || !messageInputDom.value) return
  try {
    await processFiles(files, messageInputDom.value, showFileModalCallback)
  } catch (error) {
    logger.error('处理拖拽文件失败:', error)
    showFeedback('处理拖拽文件失败', 'error')
  }
}

const handleLocationSelected = async (locationData: LocationData) => {
  try {
    await sendLocationDirect(locationData)
  } catch (error) {
    logger.error('发送位置失败:', error)
    showFeedback(t('message.location.send_failed') || '发送位置失败', 'error')
  }
}

const handleAitKeyChange = (
  direction: 1 | -1,
  list: Ref<UserItem[] | AIModel[]>,
  virtualListInst: VirtualListInst,
  key: Ref<string | null>
) => {
  const currentIndex = list.value.findIndex((item) => item.uid === key.value)
  const newIndex = Math.max(0, Math.min(currentIndex + direction, list.value.length - 1))
  const item = list.value[newIndex]
  if (item) {
    key.value = item.uid
    virtualListInst?.scrollTo({ index: newIndex })
  }
}

const closeMenu = (event: MouseEvent) => {
  if (event.target instanceof HTMLElement && !event.target.matches('#message-input, #message-input *')) {
    ait.value = false
  }
}

const disableSelectAll = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'a') {
    const inputDiv = document.getElementById('message-input')
    const hasFocus = document.activeElement === inputDiv
    const hasContent = inputDiv?.textContent && inputDiv.textContent.trim().length > 0
    if (!hasFocus || !hasContent) e.preventDefault()
  }
}

const handleVoiceCancel = () => {
  isVoiceMode.value = false
}

const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

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

const setIsFocus = (value: boolean) => {
  if (
    isMobileRef.value &&
    !value &&
    (mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
      mobilePanelState.value === MobilePanelStateEnum.VOICE ||
      mobilePanelState.value === MobilePanelStateEnum.MORE)
  ) {
    return
  }

  mobilePanelState.value = value ? MobilePanelStateEnum.FOCUS : MobilePanelStateEnum.NONE
  selfEmitter('customFocus', { panelState: mobilePanelState.value })
}

const handleMoreClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.MORE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.MORE
  selfEmitter('clickMore', { panelState: mobilePanelState.value })
}

const handleEmojiClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.EMOJI ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.EMOJI
  selfEmitter('clickEmoji', { panelState: mobilePanelState.value })
}

const handleVoiceClick = () => {
  mobilePanelState.value =
    mobilePanelState.value === MobilePanelStateEnum.VOICE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.VOICE
  selfEmitter('clickVoice', { panelState: mobilePanelState.value })
}

const getInputContent = (): string => {
  if (messageInputDom.value) {
    const innerHTML = messageInputDom.value.innerHTML || ''
    if (innerHTML.includes('data-type="emoji"')) return 'emoji'
    if (innerHTML.includes('<img') || innerHTML.includes('data-type=')) return 'image'
    return messageInputDom.value.textContent?.trim() || ''
  }
  return ''
}

const determineSendType = (): 'ai' | 'im' => {
  if (props.isAIMode) return 'ai'
  return 'im'
}

const handleMobileSend = async () => {
  if (props.isAIMode && props.isAIStreaming) {
    useMitt.emit(MittEnum.AI_STOP_STREAMING)
  } else {
    await send()
  }
}

const clearInput = () => {
  if (messageInputDom.value) {
    messageInputDom.value.textContent = ''
    const event = new Event('input', { bubbles: true })
    messageInputDom.value.dispatchEvent(event)
  }
}

const handleAISend = async () => {
  const content = getInputContent()
  if (!content.trim()) {
    showFeedback('请输入消息内容', 'warning')
    return
  }
  selfEmitter('send-ai', { content })
  clearInput()
}

const handleDesktopSend = async () => {
  if (props.isAIMode && props.isAIStreaming) {
    useMitt.emit(MittEnum.AI_STOP_STREAMING)
  } else {
    await send()
  }
}

const handleEnterKey = (e: KeyboardEvent) => {
  if (determineSendType() === 'ai') {
    e.preventDefault()
    e.stopPropagation()
    if (props.isAIStreaming) {
      selfEmitter('stop-ai')
      return
    }
    handleAISend()
  } else {
    inputKeyDown(e)
  }
}

const listenMobilePanelHandler = () => {
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

const listenMobileClosePanel = () => {
  useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

const removeMobileClosePanel = () => {
  useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

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
  handleLocationSelected
})

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

onMounted(async () => {
  useMitt.on(MittEnum.GLOBAL_FILES_DROP, handleGlobalFilesDrop)
  if (isMobileRef.value) {
    listenMobileClosePanel()
  }
  onKeyStroke('Enter', () => {
    if (ait.value && Number(selectedAitKey.value) > -1) {
      const item = personList.value.find((item) => item.uid === selectedAitKey.value)
      if (item) handleAit(item)
    }
  })
  onKeyStroke('ArrowUp', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(-1, personList, virtualListInstAit.value!, selectedAitKey)
    } else if (aiDialogVisible.value) {
      handleAitKeyChange(-1, groupedAIModels, virtualListInstAI.value!, selectedAIKey)
    }
  })
  onKeyStroke('ArrowDown', (e) => {
    e.preventDefault()
    if (ait.value) {
      handleAitKeyChange(1, personList, virtualListInstAit.value!, selectedAitKey)
    } else if (aiDialogVisible.value) {
      handleAitKeyChange(1, groupedAIModels, virtualListInstAI.value!, selectedAIKey)
    }
  })
  nextTick(() => {
    if (!isMobileRef.value) {
      const inputDiv = document.getElementById('message-input')
      inputDiv?.focus()
      setIsFocus(true)
    }
  })
  useMitt.on(MittEnum.AT, (event: string | { user: UserItem }) => {
    if (typeof event === 'object' && event.user) {
      handleAit(event.user)
    } else {
      const userInfo = groupStore.getUserInfo(event as string)
      if (userInfo) handleAit(userInfo)
    }
  })
  useMitt.on(MittEnum.VOICE_RECORD_TOGGLE, () => {
    isVoiceMode.value = !isVoiceMode.value
  })
  onKeyStroke('Escape', () => {
    if (isVoiceMode.value) isVoiceMode.value = false
  })
  appWindow?.listen<{ buffer: number[]; mimeType: string }>('screenshot', async (e) => {
    if (messageInputDom.value) {
      messageInputDom.value.focus()
      try {
        const buffer = new Uint8Array(e.payload.buffer)
        const blob = new Blob([buffer], { type: e.payload.mimeType })
        const file = new File([blob], 'screenshot.png', { type: e.payload.mimeType })
        await processFiles([file], messageInputDom.value, showFileModalCallback)
      } catch (error) {
        logger.error('处理截图失败:', error)
      }
    }
  })
  window.addEventListener('click', closeMenu, true)
  window.addEventListener('keydown', disableSelectAll)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  window.removeEventListener('keydown', disableSelectAll)
  useMitt.off(MittEnum.GLOBAL_FILES_DROP, handleGlobalFilesDrop)
  if (isMobileRef.value) {
    removeMobileClosePanel()
  }
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
