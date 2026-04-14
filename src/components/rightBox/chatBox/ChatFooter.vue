<template>
  <!-- 底部栏 -->
  <main
    :class="[isMobile() ? 'flex-col w-full' : 'border-t-(1px solid [--right-chat-footer-line-color])']"
    class="h-full flex flex-col relative">
    <!-- 添加遮罩层 -->
    <div
      v-if="isSingleChat && !isFriend"
      :style="{ height: `${footerHeight}px` }"
      class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto light:bg-[rgba(255,255,255,0.1)] dark:bg-[rgba(33,33,33,0.1)]">
      <n-flex align="center" justify="center" class="pb-60px">
        <svg class="size-24px">
          <use href="#cloudError"></use>
        </svg>
        <span class="text-(14px [--chat-text-color])">{{ t('editor.relation.not_friends') }}</span>
      </n-flex>
    </div>

    <ChatMsgMultiChoose v-if="chatStore.isMsgMultiChoose" />

    <div v-if="!chatStore.isMsgMultiChoose" class="color-[--icon-color] flex flex-col flex-1 min-h-0">
      <!-- 输入框顶部选项栏 -->
      <n-flex
        v-if="!isMobile()"
        align="center"
        justify="space-between"
        class="p-[10px_22px_5px] select-none flex-shrink-0">
        <n-flex align="center" :size="0" class="input-options">
          <ChatEmojiPicker
            :disabled="chatStore.isMsgMultiChoose"
            @emojiSelect="handleEmojiSelect"
            @emojiUrlSelect="handleEmojiUrlSelect" />

          <ChatFooterToolbar
            :is-conceal="isConceal"
            :is-burn-after-read="isBurnAfterRead"
            :shortcut="settingStore.shortcuts.screenshot"
            @screenshot="handleScreenshot()"
            @toggle-conceal="isConceal = !isConceal"
            @open-file="handleFileOpen"
            @open-image="handleImageOpen"
            @voice-record="handleVoiceRecord"
            @open-location="showLocationModal = true"
            @toggle-burn-after-read="toggleBurnAfterRead" />
        </n-flex>

        <n-popover trigger="hover" :show-arrow="false" placement="bottom">
          <template #trigger>
            <svg class="w-22px h-22px cursor-pointer outline-none" @click="openChatHistory">
              <use href="#history"></use>
            </svg>
          </template>
          <span>{{ t('editor.chat_history') }}</span>
        </n-popover>
      </n-flex>

      <!-- 输入框区域 -->
      <div :class="[isMobile() ? '' : 'pl-20px ']" class="flex flex-1 min-h-0">
        <MsgInput
          ref="MsgInputRef"
          @clickMore="handleMoreClick"
          @clickEmoji="handleEmojiClick"
          @clickVoice="handleVoiceClick"
          @customFocus="handleCustomFocus"
          @send="handleSend" />
      </div>
    </div>

    <!-- 位置选择弹窗 -->
    <LocationModal
      v-model:visible="showLocationModal"
      @location-selected="handleLocationSelected"
      @cancel="showLocationModal = false" />

    <!-- 移动端输入框点击icon弹起的面板 -->
    <Transition v-if="isMobile()" name="panel-slide">
      <div v-show="isPanelVisible" class="panel-container panel-container--fixed">
        <Transition name="panel-content" mode="out-in">
          <div v-if="mobilePanelState === MobilePanelStateEnum.EMOJI" key="emoji" class="panel-content">
            <Emoticon @emojiHandle="emojiHandle" :all="false" />
          </div>
          <div v-else-if="mobilePanelState === MobilePanelStateEnum.VOICE" key="voice" class="panel-content">
            <VoicePanel @cancel="handleMobileVoiceCancel" @send="handleMobileVoiceSend" />
          </div>
          <div v-else-if="mobilePanelState === MobilePanelStateEnum.MORE" key="more" class="panel-content">
            <More @sendFiles="handleMoreSendFiles" />
          </div>
        </Transition>
      </div>
    </Transition>
  </main>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { FOOTER_HEIGHT, MAX_FOOTER_HEIGHT, MIN_FOOTER_HEIGHT } from '@/common/constants'
import LocationModal from '@/components/rightBox/location/LocationModal.vue'
import ChatEmojiPicker from './ChatEmojiPicker.vue'
import ChatFooterToolbar from './ChatFooterToolbar.vue'
import { MittEnum, MobilePanelStateEnum, MsgEnum } from '@/enums'
import { useChatLayoutGlobal } from '@/hooks/useChatLayout'
import { type SelectionRange, useCommon } from '@/hooks/useCommon.ts'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import { useChatFooter } from '@/hooks/useChatFooter'
import type { SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/chat'
import { useGlobalStore } from '@/stores/global.ts'
import { useHistoryStore } from '@/stores/history'
import { useSettingStore } from '@/stores/setting'
import FileUtil from '@/utils/FileUtil'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChatFooter')
const { t } = useI18n()
const More = isMobile() ? defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/More.vue')) : void 0
const VoicePanel = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/VoicePanel.vue'))
  : void 0

const props = withDefaults(
  defineProps<{
    detailId?: SessionItem['detailId']
  }>(),
  {
    detailId: ''
  }
)
const detailId = computed(() => props.detailId || '')
const globalStore = useGlobalStore()
const historyStore = useHistoryStore()
const chatStore = useChatStore()
const settingStore = useSettingStore()
const { handleScreenshot } = useGlobalShortcut()
const MsgInputRef = ref()
const msgInputDom = ref<HTMLInputElement | null>(null)
const showLocationModal = ref(false)

const { isBurnAfterRead, isSingleChat, isFriend, toggleBurnAfterRead } = useChatFooter()

const emojiShow = ref(false)

const isConceal = computed({
  get: () => settingStore.screenshot.isConceal,
  set: (value: boolean) => settingStore.setScreenshotConceal(value)
})
const { insertNodeAtRange, triggerInputEvent, processFiles, imgPaste } = useCommon()

// 使用全局布局状态
const { footerHeight, setFooterHeight } = useChatLayoutGlobal()

// 使用窗口管理
const { createWebviewWindow } = useWindow()

// 容器高度响应式状态
const containerHeight = ref(600) // 默认高度

// 动态计算最大高度
const maxHeight = computed(() => {
  // 确保最大高度不超过390px，也不小于最小高度200px
  return Math.max(Math.min(MAX_FOOTER_HEIGHT), MIN_FOOTER_HEIGHT)
})

// 动态计算当前最小高度（根据录音模式状态）
const currentMinHeight = computed(() => {
  return MsgInputRef.value?.isVoiceMode ? FOOTER_HEIGHT : MIN_FOOTER_HEIGHT
})

// 监听maxHeight变化，确保footerHeight不超过最大值（即时响应）
watch(
  maxHeight,
  (newMaxHeight) => {
    if (footerHeight.value > newMaxHeight) {
      setFooterHeight(newMaxHeight)
    }
  },
  {
    immediate: true,
    flush: 'sync'
  }
)

// 监听最小高度变化，确保footerHeight不低于最小值
watch(
  currentMinHeight,
  (newMinHeight) => {
    if (footerHeight.value < newMinHeight) {
      setFooterHeight(newMinHeight)
    }
  },
  {
    immediate: true,
    flush: 'sync'
  }
)

// 高效的尺寸变化监听
const observeContainerResize = () => {
  const chatContainer = document.querySelector('.h-full') || document.querySelector('[data-chat-container]')
  if (!chatContainer) return
  containerHeight.value = (chatContainer as HTMLElement).clientHeight
}

const handleFileOpen = async () => {
  const filesData = await FileUtil.openAndCopyFile()
  if (!filesData) return
  await processFiles(filesData.files, MsgInputRef.value.messageInputDom, MsgInputRef.value?.showFileModal)
}

const handleImageOpen = async () => {
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Images',
        extensions: ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'svg']
      }
    ]
  })

  if (selected && Array.isArray(selected)) {
    const imagePromises = selected.map(async (path) => {
      const fileData = await readFile(path)
      const fileName = extractFileName(path)
      const mimeType = getMimeTypeFromExtension(fileName)

      const blob = new Blob([new Uint8Array(fileData)], { type: mimeType })
      return new File([blob], fileName, { type: mimeType })
    })

    const files = await Promise.all(imagePromises)

    for (const file of files) {
      await imgPaste(file, MsgInputRef.value.messageInputDom)
    }
  }
}

type EmojiUrlPayload = { renderUrl: string; serverUrl: string }

const handleEmojiSelect = (emoji: string) => {
  updateRecentEmojis(emoji)
  MsgInputRef.value?.focus()
  const inp = msgInputDom.value
  if (inp) {
    insertNodeAtRange(MsgEnum.TEXT, emoji, inp, MsgInputRef.value?.getLastEditRange())
    triggerInputEvent(inp)
  }
}

const handleEmojiUrlSelect = (payload: EmojiUrlPayload) => {
  updateRecentEmojis(payload.serverUrl)
  MsgInputRef.value?.focus()
  const inp = msgInputDom.value
  if (!inp) return

  const lastEditRange = MsgInputRef.value?.getLastEditRange()
  if (!lastEditRange) return

  const imgElement = document.createElement('img')
  imgElement.src = payload.renderUrl
  imgElement.style.maxWidth = '80px'
  imgElement.style.maxHeight = '80px'
  imgElement.dataset.type = 'emoji'
  imgElement.dataset.serverUrl = payload.serverUrl

  lastEditRange.range.insertNode(imgElement)

  const range = document.createRange()
  range.setStartAfter(imgElement)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  MsgInputRef.value?.updateSelectionRange()
  triggerInputEvent(inp)
}

const sendEmojiWithDebounce = useDebounceFn((payload: EmojiUrlPayload) => {
  try {
    MsgInputRef.value?.sendEmojiDirect(payload.serverUrl).catch((error: unknown) => {
      logger.error('发送表情包失败:', error)
      window.$message?.error?.('发送表情包失败')
    })

    updateRecentEmojis(payload.serverUrl)
  } catch (error) {
    logger.error('发送表情包失败:', error)
    window.$message?.error?.('发送表情包失败')
  }
}, 200)

const emojiHandle = async (item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url' = 'emoji') => {
  emojiShow.value = false

  const inp = msgInputDom.value
  if (!inp) {
    return
  }

  const isEmojiUrlPayload = (value: unknown): value is EmojiUrlPayload =>
    value !== null && typeof value === 'object' && typeof (value as EmojiUrlPayload).serverUrl === 'string'

  if (isMobile() && type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    sendEmojiWithDebounce(payload)
    return
  }

  MsgInputRef.value?.focus()

  let lastEditRange: SelectionRange | null = MsgInputRef.value?.getLastEditRange()

  const isRangeInInput = (range: Range | null): boolean => {
    if (!range || !inp) return false
    try {
      return inp.contains(range.commonAncestorContainer)
    } catch {
      return false
    }
  }

  if (!lastEditRange || !isRangeInInput(lastEditRange.range)) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && isRangeInInput(selection.getRangeAt(0))) {
      lastEditRange = {
        range: selection.getRangeAt(0),
        selection
      }
    } else {
      const range = document.createRange()
      range.selectNodeContents(inp)
      range.collapse(false)
      lastEditRange = {
        range,
        selection: window.getSelection()!
      }
    }
  }

  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(lastEditRange.range)
  }

  // 根据内容类型插入不同的节点
  if (type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    const renderUrl = payload.renderUrl || payload.serverUrl
    const serverUrl = payload.serverUrl || payload.renderUrl
    if (!renderUrl) return
    // 如果是URL，创建图片元素并插入
    const imgElement = document.createElement('img')
    imgElement.src = renderUrl
    imgElement.style.maxWidth = '80px'
    imgElement.style.maxHeight = '80px'
    // 设置数据类型，区分是普通图片还是表情包
    imgElement.dataset.type = 'emoji'
    if (serverUrl) {
      imgElement.dataset.serverUrl = serverUrl
    }

    // 在用户光标位置插入表情包
    lastEditRange.range.insertNode(imgElement)

    // 移动光标到图片后面
    const range = document.createRange()
    range.setStartAfter(imgElement)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
  } else {
    const emojiText = typeof item === 'string' ? item : ''
    insertNodeAtRange(MsgEnum.TEXT, emojiText, inp, lastEditRange)
  }

  // 记录新的选区位置
  MsgInputRef.value?.updateSelectionRange()

  // 触发输入事件
  triggerInputEvent(inp)

  // 保持焦点在输入框
  MsgInputRef.value?.focus()

  // 添加到最近使用表情列表
  if (type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    updateRecentEmojis(payload.serverUrl || payload.renderUrl)
  } else {
    updateRecentEmojis(typeof item === 'string' ? item : '')
  }
}

/**
 * 更新最近使用的表情列表
 */
const updateRecentEmojis = (emoji: string) => {
  const currentEmojis = [...historyStore.emoji]
  const index = currentEmojis.indexOf(emoji)
  if (index !== -1) {
    currentEmojis.splice(index, 1)
  }
  currentEmojis.unshift(emoji)
  const updatedEmojis = currentEmojis.slice(0, 15)
  historyStore.setEmoji(updatedEmojis)
}

const handleVoiceRecord = () => {
  useMitt.emit(MittEnum.VOICE_RECORD_TOGGLE)
}

const handleLocationSelected = async (locationData: unknown) => {
  try {
    await MsgInputRef.value.handleLocationSelected(locationData)
    showLocationModal.value = false
  } catch (error) {
    logger.error('发送位置消息失败:', error)
  }
}

const openChatHistory = async () => {
  const currentRoomId = globalStore.currentSessionRoomId

  // 创建聊天记录窗口
  await createWebviewWindow('聊天记录', 'chat-history', 800, 600, undefined, true, 600, 400, false, false, {
    roomId: currentRoomId
  })
}

/**
 *
 * 移动端代码（开始）
 *
 *
 */

// 移动端面板状态 - 从 MsgInput 同步过来
const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

// 计算面板是否可见
const isPanelVisible = computed(() => {
  return (
    mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
    mobilePanelState.value === MobilePanelStateEnum.VOICE ||
    mobilePanelState.value === MobilePanelStateEnum.MORE
  )
})

/** 点击更多按钮 */
const handleMoreClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 点击表情按钮 */
const handleEmojiClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 点击语音按钮 */
const handleVoiceClick = (value: { panelState: MobilePanelStateEnum }) => {
  mobilePanelState.value = value.panelState
}

/** 自定义聚焦事件 */
const handleCustomFocus = (value: { panelState: MobilePanelStateEnum }) => {
  // 如果是聚焦状态，关闭面板
  if (value.panelState === MobilePanelStateEnum.FOCUS) {
    mobilePanelState.value = MobilePanelStateEnum.NONE
  } else {
    mobilePanelState.value = value.panelState
  }
}

/** 取消语音录制 */
const handleMobileVoiceCancel = () => {
  useMitt.emit(MittEnum.MOBILE_CLOSE_PANEL)
  // 重置状态
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/** 发送语音消息 */
const handleMobileVoiceSend = async (voiceData: any) => {
  try {
    await MsgInputRef.value?.sendVoiceDirect(voiceData)
  } catch (error) {
    logger.error('发送语音失败', error)
  }
  // 发送后关闭面板
  handleMobileVoiceCancel()
}

const handleMoreSendFiles = async (files: File[]) => {
  if (!files || files.length === 0) return
  try {
    await MsgInputRef.value?.sendFilesDirect(files)
  } catch (error) {
    logger.error('移动端发送文件失败:', error)
    window.$message?.error?.('发送文件失败')
  }
}

/** 处理发送事件 */
const handleSend = () => {
  // 发送后不关闭面板，保持当前状态
  // mobilePanelState.value = MobilePanelStateEnum.NONE
}

/**
 * 监听移动端关闭面板事件
 */
const listenMobilePanelHandler = () => {
  mobilePanelState.value = MobilePanelStateEnum.NONE
}

/**
 * 监听移动端关闭面板事件
 */
const listenMobileClosePanel = () => {
  useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/**
 * 移除移动端关闭面板事件
 */
const removeMobileClosePanel = () => {
  useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
}

/**
 *
 * 移动端代码（结束）
 *
 */

onMounted(async () => {
  if (isMobile()) {
    // 监听移动端关闭面板事件
    listenMobileClosePanel()
  }

  await nextTick()
  // 启动高效的容器尺寸监听
  observeContainerResize()

  if (MsgInputRef.value) {
    msgInputDom.value = MsgInputRef.value.messageInputDom
  }
})

onUnmounted(() => {
  if (isMobile()) {
    // 移除移动端关闭面板事件
    removeMobileClosePanel()
  }
})
</script>

<style scoped lang="scss">
.input-options {
  svg {
    width: 22px;
    height: 22px;
    cursor: pointer;

    &:hover {
      color: #13987f;
    }
  }

  .dropdown-arrow {
    transition: transform 0.3s ease;

    &:hover {
      transform: rotate(180deg);
    }
  }
}

:deep(.n-input .n-input-wrapper) {
  padding: 0;
}

// 移动端样式（下面都是）

/* 面板容器样式 */
.panel-container {
  width: 100%;
  overflow: hidden;
  background-color: var(--bg-emoji, #f5f5f5);
  display: flex;
  flex-direction: column;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-container--fixed {
  height: 18rem;
}

/* 使用 transform 实现高性能动画 - 从下往上滑出 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom;
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.panel-slide-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.panel-content-enter-active,
.panel-content-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.panel-content-enter-from,
.panel-content-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.panel-content-enter-to,
.panel-content-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
