<template>
  <!-- 底部栏 -->
  <main
    :class="[
      isMobile() ? 'flex-col w-full' : 'border-t-(1px solid [--tjg-border-default])',
      { 'private-mode-footer': privateModeActive }
    ]"
    class="h-full flex flex-col relative">
    <!-- 覆盖层状态 -->
    <FooterOverlays
      v-if="!chatStore.isMsgMultiChoose"
      :is-single-chat="isSingleChat"
      :is-session-target-pending="isSessionTargetPending"
      :is-friend="isFriend"
      :is-room-readonly="isRoomReadonly"
      :footer-height="footerHeight" />

    <ChatMsgMultiChoose v-if="chatStore.isMsgMultiChoose" />

    <div v-if="!chatStore.isMsgMultiChoose" class="color-[--tjg-text-secondary] flex flex-col flex-1 min-h-0">
      <!-- 桌面端工具栏 -->
      <FooterToolbar
        v-if="!isMobile()"
        v-model:emoji-show="emojiShow"
        v-model:recently-tip="recentlyTip"
        v-model:is-conceal="isConceal"
        :recent-emojis="recentEmojis"
        :burn-after-read-enabled="burnAfterReadEnabled"
        :screenshot-shortcut="settingStore.screenshotShortcut"
        :disabled="chatStore.isMsgMultiChoose"
        :check-is-url="checkIsUrl"
        :resolve-recent-render-url="resolveRecentRenderUrl"
        @emoji-handle="emojiHandle"
        @handle-screenshot="handleScreenshot"
        @handle-file-open="handleFileOpen"
        @handle-image-open="handleImageOpen"
        @handle-voice-record="handleVoiceRecord"
        @show-location-modal="showLocationModal = true"
        @toggle-burn-after-read="toggleBurnAfterRead"
        @open-chat-history="openChatHistory" />

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

    <!-- 移动端面板 -->
    <MobilePanel
      v-if="isMobile()"
      :is-panel-visible="isPanelVisible"
      :mobile-panel-state="mobilePanelState"
      @emoji-handle="emojiHandle"
      @mobile-voice-cancel="handleMobileVoiceCancel"
      @mobile-voice-send="handleMobileVoiceSend"
      @more-send-files="handleMoreSendFiles" />
  </main>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { useI18n } from 'vue-i18n'
import { FOOTER_HEIGHT, MAX_FOOTER_HEIGHT, MIN_FOOTER_HEIGHT } from '@/common/constants'
import LocationModal from '@/components/rightBox/location/LocationModal.vue'
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'
import { useFooterEmoji } from '@/composables/chat/useFooterEmoji'
import { useFooterOverlays } from '@/composables/chat/useFooterOverlays'
import { useMobilePanel } from '@/composables/chat/useMobilePanel'
import { useChatLayoutGlobal } from '@/composables/chat/useChatLayout'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type SelectionRange, useCommon } from '@/composables/common/useCommon'
import { useGlobalShortcut } from '@/composables/common/useGlobalShortcut'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { MittEnum } from '@/enums'
import type { SessionItem } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import type { LocationData } from '@/types/common'
import FileUtil from '@/utils/FileUtil'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import FooterOverlays from './FooterOverlays.vue'
import FooterToolbar from './FooterToolbar.vue'
import MobilePanel from './MobilePanel.vue'

const logger = createLogger('ChatFooter')
const privateModeActive = ref(false)
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

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
const chatStore = useChatStore()
const settingStore = useSettingStore()
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
const burnAfterRead = useBurnAfterRead()
const burnAfterReadEnabled = computed(() => burnAfterRead.isRoomBurnEnabled())

const isConceal = computed({
  get: () => settingStore.screenshotConcealEnabled,
  set: (value: boolean) => settingStore.setScreenshotConceal(value)
})

const { processFiles, imgPaste } = useCommon()
const { footerHeight, setFooterHeight } = useChatLayoutGlobal()
const { createWebviewWindow } = useWindow()

// ===== 覆盖层状态 =====
const { isSingleChat, isSessionTargetPending, isFriend, isRoomReadonly } = useFooterOverlays(detailId)

// ===== 表情处理 =====
const { recentEmojis, checkIsUrl, resolveRecentRenderUrl, emojiHandle } = useFooterEmoji(
  MsgInputRef,
  msgInputDom,
  emojiShow
)

// ===== 移动端面板 =====
const {
  mobilePanelState,
  isPanelVisible,
  handleMoreClick,
  handleEmojiClick,
  handleVoiceClick,
  handleCustomFocus,
  handleMobileVoiceCancel,
  handleMobileVoiceSend,
  handleMoreSendFiles,
  handleSend,
  listenMobileClosePanel,
  removeMobileClosePanel
} = useMobilePanel(MsgInputRef)

// ===== 布局管理 =====
const containerHeight = ref(600)

const maxHeight = computed(() => {
  return Math.max(Math.min(MAX_FOOTER_HEIGHT), MIN_FOOTER_HEIGHT)
})

const currentMinHeight = computed(() => {
  return MsgInputRef.value?.isVoiceMode ? FOOTER_HEIGHT : MIN_FOOTER_HEIGHT
})

watch(
  maxHeight,
  (newMaxHeight) => {
    if (footerHeight.value > newMaxHeight) {
      setFooterHeight(newMaxHeight)
    }
  },
  { immediate: true, flush: 'sync' }
)

watch(
  currentMinHeight,
  (newMinHeight) => {
    if (footerHeight.value < newMinHeight) {
      setFooterHeight(newMinHeight)
    }
  },
  { immediate: true, flush: 'sync' }
)

const observeContainerResize = () => {
  const chatContainer = document.querySelector('.h-full') || document.querySelector('[data-chat-container]')
  if (!chatContainer) return
  containerHeight.value = (chatContainer as HTMLElement).clientHeight
}

// ===== Watchers =====
watch(emojiShow, (newValue) => {
  if (newValue === true) {
    recentlyTip.value = false
  }
})

// ===== 文件/图片处理 =====
const handleFileOpen = async () => {
  const filesData = await FileUtil.openAndCopyFile()
  if (!filesData || !MsgInputRef.value) return
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
      if (!MsgInputRef.value) break
      await imgPaste(file, MsgInputRef.value.messageInputDom)
    }
  }
}

// ===== 语音/位置/阅后即焚/聊天记录 =====
const handleVoiceRecord = () => {
  useMitt.emit(MittEnum.VOICE_RECORD_TOGGLE)
}

const handleLocationSelected = async (locationData: LocationData) => {
  try {
    await MsgInputRef.value?.handleLocationSelected(locationData)
    showLocationModal.value = false
  } catch (error) {
    logger.error('发送位置消息失败:', error)
  }
}

const toggleBurnAfterRead = async () => {
  try {
    await burnAfterRead.toggleRoomBurn()
    if (burnAfterReadEnabled.value) {
      showFeedback(t('editor.burn_after_read_enabled'), 'success')
    } else {
      showFeedback(t('editor.burn_after_read_disabled'), 'info')
    }
  } catch {
    showFeedback(t('editor.burn_after_read_disabled'), 'error')
  }
}

const openChatHistory = async () => {
  const currentRoomId = globalStore.currentSessionRoomId
  await createWebviewWindow('聊天记录', 'chat-history', 800, 600, undefined, true, 600, 400, false, false, {
    roomId: currentRoomId
  })
}

// ===== 私密模式监听 =====
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}

// ===== 生命周期 =====
onMounted(async () => {
  if (isMobile()) {
    listenMobileClosePanel()
  }
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)

  await nextTick()
  observeContainerResize()

  if (MsgInputRef.value) {
    msgInputDom.value = MsgInputRef.value.messageInputDom
  }
})

onUnmounted(() => {
  if (isMobile()) {
    removeMobileClosePanel()
  }
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
</script>

<style scoped lang="scss">
:deep(.n-input .n-input-wrapper) {
  padding: 0;
}

.private-mode-footer {
  border-top: 2px dashed var(--tjg-color-danger-500) !important;
}
</style>
