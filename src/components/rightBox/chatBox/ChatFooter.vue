<template>
  <!-- 底部栏 -->
  <main
    :class="[isMobile() ? 'flex-col w-full' : 'border-t-(1px solid [--hula-border-default])']"
    class="h-full flex flex-col relative">
    <!-- 添加遮罩层 -->
    <div
      v-if="isSingleChat && isSessionTargetPending"
      :style="{ height: `${footerHeight}px` }"
      class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--hula-surface-overlay]">
      <n-flex align="center" justify="center" class="pb-60px">
        <span class="text-(14px [--hula-text-tertiary])">正在准备会话...</span>
      </n-flex>
    </div>
    <div
      v-else-if="isSingleChat && !isFriend"
      :style="{ height: `${footerHeight}px` }"
      class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--hula-surface-overlay]">
      <n-flex align="center" justify="center" class="pb-60px">
        <svg class="size-24px">
          <use href="#cloudError"></use>
        </svg>
        <span class="text-(14px [--hula-text-tertiary])">{{ t('editor.relation.not_friends') }}</span>
      </n-flex>
    </div>

    <ChatMsgMultiChoose v-if="chatStore.isMsgMultiChoose" />

    <div v-if="!chatStore.isMsgMultiChoose" class="color-[--hula-text-secondary] flex flex-col flex-1 min-h-0">
      <!-- 输入框顶部选项栏 -->
      <n-flex
        v-if="!isMobile()"
        align="center"
        justify="space-between"
        class="p-[10px_22px_5px] select-none flex-shrink-0">
        <n-flex align="center" :size="0" class="input-options">
          <!-- emoji表情 -->
          <n-popover
            v-model:show="emojiShow"
            trigger="click"
            :show-arrow="false"
            placement="top-start"
            :disabled="chatStore.isMsgMultiChoose"
            style="
              padding: 0;
              background: var(--hula-surface-panel);
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              box-shadow: var(--hula-shadow-md);
              border: 1px solid var(--hula-border-default);
              width: auto;
            ">
            <template #trigger>
              <n-popover
                v-model:show="recentlyTip"
                trigger="hover"
                :delay="800"
                :duration="100"
                :show-arrow="false"
                :disabled="emojiShow || recentEmojis.length < 4"
                placement="top">
                <template #trigger>
                  <svg class="mr-18px">
                    <use href="#smiling-face"></use>
                  </svg>
                </template>
                <div v-if="recentEmojis.length > 0" class="p-4px">
                  <div class="text-xs text-[--hula-text-tertiary] mb-4px">最近使用</div>
                  <div class="flex flex-wrap gap-8px max-w-212px">
                    <div
                      v-for="(emoji, index) in recentEmojis"
                      :key="index"
                      class="emoji-item cursor-pointer flex-center"
                      @click="
                        emojiHandle(
                          checkIsUrl(emoji) ? { renderUrl: resolveRecentRenderUrl(emoji), serverUrl: emoji } : emoji,
                          checkIsUrl(emoji) ? 'emoji-url' : 'emoji'
                        )
                      ">
                      <img v-if="checkIsUrl(emoji)" :src="resolveRecentRenderUrl(emoji)" class="size-24px" />
                      <span v-else class="text-18px">{{ emoji }}</span>
                    </div>
                  </div>
                </div>
              </n-popover>
            </template>
            <Emoticon @emojiHandle="emojiHandle" :all="false" />
          </n-popover>

          <div class="flex-center gap-2px mr-12px">
            <svg @click="handleScreenshot()">
              <use href="#screenshot"></use>
            </svg>
            <n-popover
              style="
                padding: 0;
                background: var(--hula-surface-panel);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                box-shadow: var(--hula-shadow-md);
                border: 1px solid var(--hula-border-default);
              "
              trigger="hover"
              :show-arrow="false"
              placement="top">
              <template #trigger>
                <svg class="dropdown-arrow" style="width: 14px; height: 14px">
                  <use href="#down"></use>
                </svg>
              </template>

              <div class="footer-item">
                <n-flex
                  @click="handleScreenshot()"
                  class="text-12px cursor-pointer group"
                  align="center"
                  justify="space-between">
                  <n-flex align="center" :size="6">
                    <svg class="size-14px">
                      <use href="#screenshot"></use>
                    </svg>
                    <p>{{ t('editor.screenshot') }}</p>
                  </n-flex>
                  <p class="text-(12px --hula-text-tertiary)">{{ settingStore.screenshotShortcut }}</p>
                </n-flex>

                <n-flex
                  class="text-12px cursor-pointer group"
                  align="center"
                  justify="space-between"
                  @click="isConceal = !isConceal">
                  <n-checkbox v-model:checked="isConceal" @click.stop />
                  <p class="text-(12px [--hula-text-primary])">{{ t('editor.screenshot_hide_curr_window') }}</p>
                </n-flex>
              </div>
            </n-popover>
          </div>

          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <div class="flex-center gap-2px mr-12px">
                <svg @click="handleFileOpen">
                  <use href="#file2"></use>
                </svg>
                <svg style="width: 14px; height: 14px">
                  <use href="#down"></use>
                </svg>
              </div>
            </template>
            <span>{{ t('editor.file') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="handleImageOpen" class="mr-18px">
                <use href="#photo"></use>
              </svg>
            </template>
            <span>{{ t('editor.image') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="handleVoiceRecord" class="mr-18px">
                <use href="#voice"></use>
              </svg>
            </template>
            <span>{{ t('editor.voice') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg @click="showLocationModal = true" class="mr-18px">
                <use href="#local"></use>
              </svg>
            </template>
            <span>{{ t('editor.location') }}</span>
          </n-popover>

          <n-popover trigger="hover" :show-arrow="false" placement="bottom">
            <template #trigger>
              <svg
                :class="{ 'text-[--hula-color-primary-500]': burnAfterReadEnabled }"
                @click="toggleBurnAfterRead"
                class="mr-18px cursor-pointer">
                <use href="#timer"></use>
              </svg>
            </template>
            <span>{{ t('editor.burn_after_read') }}</span>
          </n-popover>
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
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { FOOTER_HEIGHT, MAX_FOOTER_HEIGHT, MIN_FOOTER_HEIGHT } from '@/common/constants'
import LocationModal from '@/components/rightBox/location/LocationModal.vue'
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { MittEnum, MobilePanelStateEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { useChatLayoutGlobal } from '@/hooks/useChatLayout'
import { type SelectionRange, useCommon } from '@/hooks/useCommon.ts'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow'
import type { FriendItem, SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useHistoryStore } from '@/stores/domains/chat/history'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import type { LocationData } from '@/types/common'
import FileUtil from '@/utils/FileUtil'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('ChatFooter')
const { t } = useI18n()
// 移动端组件条件导入
const Emoticon = defineAsyncComponent(() => import('@/components/rightBox/emoticon/index.vue'))
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
const contactStore = useContactStore()
const historyStore = useHistoryStore()
const chatStore = useChatStore()
const settingStore = useSettingStore()
const emojiStore = useEmojiStore()
const { handleScreenshot } = useGlobalShortcut()
type MsgInputInstance = {
  messageInputDom: HTMLElement
  showFileModal: (files: unknown[]) => void
  sendEmojiDirect: (serverUrl: string) => Promise<void>
  focus: () => void
  getLastEditRange: () => SelectionRange | null
  updateSelectionRange: () => void
  handleLocationSelected: (locationData: LocationData) => Promise<void>
  sendVoiceDirect: (voiceData: VoiceRecordPayload) => Promise<void>
  sendFilesDirect: (files: File[]) => Promise<void>
  isVoiceMode?: boolean
}

const MsgInputRef = ref<MsgInputInstance | null>(null)
const msgInputDom = ref<HTMLElement | null>(null)
const emojiShow = ref(false)
const recentlyTip = ref(false)
const showLocationModal = ref(false)
const burnAfterReadEnabled = computed(() => burnAfterRead.isRoomBurnEnabled())
const burnAfterRead = useBurnAfterRead()

const isConceal = computed({
  get: () => settingStore.screenshotConcealEnabled,
  set: (value: boolean) => settingStore.setScreenshotConceal(value)
})
const recentEmojis = computed(() => {
  return historyStore.emoji.slice(0, 15)
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
  // 设置初始高度
  containerHeight.value = (chatContainer as HTMLElement).clientHeight
}

/**
 * 检查字符串是否为URL
 */
const checkIsUrl = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

// 最近使用的表情包在顶层快捷栏也优先使用本地渲染
const resolveRecentRenderUrl = (url: string) => {
  const matched = emojiStore.emojiList.find((item) => item.expressionUrl === url)
  return matched?.localUrl || url
}

// 判断是否为单聊
const isSingleChat = computed(() => {
  return globalStore.currentSession?.type === RoomTypeEnum.SINGLE
})

const isSessionTargetPending = computed(() => {
  return isSingleChat.value && !detailId.value
})

/** 是否是好友关系 */
const isFriend = computed(() => {
  if (!isSingleChat.value) return true
  const target = detailId.value
  if (!target) return true
  return contactStore.contactsList.some((contact: FriendItem) => contact.uid === target)
})

// 监听emojiShow的变化，当emojiShow为true时关闭recentlyTip
watch(emojiShow, (newValue) => {
  if (newValue === true) {
    recentlyTip.value = false
  }
})

// 文件选择（不限制类型）
const handleFileOpen = async () => {
  const filesData = await FileUtil.openAndCopyFile()
  if (!filesData || !MsgInputRef.value) return
  // 使用processFiles方法进行文件类型验证
  await processFiles(filesData.files, MsgInputRef.value.messageInputDom, MsgInputRef.value?.showFileModal)
}

// 图片选择（只能选择图片类型）
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
    // 并行处理所有图片文件
    const imagePromises = selected.map(async (path) => {
      const fileData = await readFile(path)
      const fileName = extractFileName(path)
      const mimeType = getMimeTypeFromExtension(fileName)

      const blob = new Blob([new Uint8Array(fileData)], { type: mimeType })
      return new File([blob], fileName, { type: mimeType })
    })

    const files = await Promise.all(imagePromises)

    // 将所有图片插入到输入框
    for (const file of files) {
      if (!MsgInputRef.value) break
      await imgPaste(file, MsgInputRef.value.messageInputDom)
    }
  }
}

// 使用 VueUse 的防抖函数处理表情包发送（300ms 防抖）
type EmojiUrlPayload = { renderUrl: string; serverUrl: string }

const sendEmojiWithDebounce = useDebounceFn((payload: EmojiUrlPayload) => {
  try {
    // 不等待发送完成，立即返回（避免卡顿）
    MsgInputRef.value?.sendEmojiDirect(payload.serverUrl).catch((error: unknown) => {
      logger.error('发送表情包失败:', error)
      window.$message?.error?.('发送表情包失败')
    })

    // 添加到最近使用表情列表
    updateRecentEmojis(payload.serverUrl)
  } catch (error) {
    logger.error('发送表情包失败:', error)
    window.$message?.error?.('发送表情包失败')
  }
}, 200)

/**
 * 选择表情，并把表情插入输入框
 * @param item 选择的表情
 * @param type 表情类型，'emoji' 为普通表情，'emoji-url' 为表情包URL
 */
const emojiHandle = async (item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url' = 'emoji') => {
  emojiShow.value = false

  const inp = msgInputDom.value
  if (!inp) {
    return
  }

  const isEmojiUrlPayload = (value: unknown): value is EmojiUrlPayload =>
    value !== null && typeof value === 'object' && typeof (value as { serverUrl?: unknown }).serverUrl === 'string'

  // 移动端且是表情包URL时，使用防抖发送（发送服务端URL）
  if (isMobile() && type === 'emoji-url') {
    const payload: EmojiUrlPayload = isEmojiUrlPayload(item)
      ? item
      : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    sendEmojiWithDebounce(payload)
    return
  }

  // 桌面端或普通emoji，插入到输入框
  // 确保输入框有焦点
  MsgInputRef.value?.focus()

  // 尝试获取最后的编辑范围
  let lastEditRange: SelectionRange | null = MsgInputRef.value?.getLastEditRange() ?? null

  // 验证选区是否在输入框内
  const isRangeInInput = (range: Range | null): boolean => {
    if (!range || !inp) return false
    try {
      return inp.contains(range.commonAncestorContainer)
    } catch {
      return false
    }
  }

  // 如果没有有效的编辑范围，或选区不在输入框内，创建一个新的范围
  if (!lastEditRange || !isRangeInInput(lastEditRange.range)) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && isRangeInInput(selection.getRangeAt(0))) {
      // 只有当前选区在输入框内时才使用
      lastEditRange = {
        range: selection.getRangeAt(0),
        selection
      }
    } else {
      // 创建一个新的范围到输入框末尾
      const range = document.createRange()
      range.selectNodeContents(inp)
      range.collapse(false)
      lastEditRange = {
        range,
        selection: window.getSelection()!
      }
    }
  }

  // 清空上下文选区并设置新的选区
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
  // 触发录音模式切换事件
  useMitt.emit(MittEnum.VOICE_RECORD_TOGGLE)
}

// 处理位置选择
const handleLocationSelected = async (locationData: LocationData) => {
  try {
    await MsgInputRef.value?.handleLocationSelected(locationData)
    showLocationModal.value = false
  } catch (error) {
    logger.error('发送位置消息失败:', error)
  }
}

// 切换阅后即焚状态
const toggleBurnAfterRead = async () => {
  try {
    await burnAfterRead.toggleRoomBurn()
    if (burnAfterReadEnabled.value) {
      window.$message.success(t('editor.burn_after_read_enabled'))
    } else {
      window.$message.info(t('editor.burn_after_read_disabled'))
    }
  } catch {
    window.$message.error(t('editor.burn_after_read_disabled'))
  }
}

// 打开聊天记录窗口
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
const handleMobileVoiceSend = async (voiceData: VoiceRecordPayload) => {
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
      color: var(--hula-color-primary-500);
    }
  }

  .dropdown-arrow {
    transition: transform 0.3s ease;

    &:hover {
      transform: rotate(180deg);
    }
  }
}

.resize-indicator {
  width: 40px;
  height: 3px;
  background: var(--hula-text-tertiary);
  border-radius: 2px;
  opacity: 0.3;
  transition: all 0.2s ease;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 1px;
    background: var(--hula-text-secondary);
    border-radius: 1px;
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 1px;
    background: var(--hula-text-secondary);
    border-radius: 1px;
    opacity: 0.5;
  }
}

.footer-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  min-width: 160px;
  box-sizing: border-box;
  width: fit-content;
  height: fit-content;
  user-select: none;

  .group {
    padding: 4px 6px;
    border-radius: 4px;

    &:hover {
      background-color: var(--hula-fill-hover);

      svg {
        animation: twinkle 0.3s ease-in-out;
      }
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
  background-color: var(--hula-surface-panel-muted);
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
