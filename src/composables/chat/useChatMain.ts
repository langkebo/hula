import { computed, type InjectionKey, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDownload } from '@/composables/common/useDownload'
import { useVideoViewer } from '@/composables/common/useVideoViewer'
import { CallTypeEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useWindow } from '../common/useWindow'
import { createEmojiList } from './emojiMenuData'
import { clearSelection, getSelectedText, hasSelectedText } from './selectionUtils'
import { useChatContextMenus } from './useChatContextMenus'
import { useChatCopy } from './useChatCopy'
import { useChatFileDownload } from './useChatFileDownload'
import { useGroupNicknameModal } from './useGroupNicknameModal'
import { useMsgRecallConfirm } from './useMsgRecallConfirm'

type UseChatMainOptions = {
  enableGroupNicknameModal?: boolean
  disableHistoryActions?: boolean
  /** 点击消息气泡是否高亮（移动端不参与，由宿主声明；默认 true） */
  activeBubbleEnabled?: boolean
  /** 点击头像是否进入个人资料页（移动端行为；默认 false，即选中该消息） */
  avatarClickOpensProfile?: boolean
}

/**
 * 聊天主交互编排层
 *
 * 职责已拆分为专职 composable：
 * - 右键菜单工厂 → useChatContextMenus（含 useGroupRoleGuard 群角色权限）
 * - 撤回确认弹窗 → useMsgRecallConfirm
 * - 复制 → useChatCopy；附件下载 → useChatFileDownload；群昵称弹窗 → useGroupNicknameModal
 *
 * 本文件只保留：气泡点击/键盘复制、UI 状态（scrollTop/activeBubble/historyIndex/selectKey）、
 * 以及各子模块的装配与对外统一出口（provide/inject 形状保持不变）。
 */
export const useChatMain = (isHistoryMode = false, options: UseChatMainOptions = {}) => {
  const { t } = useI18n()
  const { createWebviewWindow, sendWindowPayload, startRtcCall } = useWindow()
  const { getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
  const chatStore = useChatStore()
  const userStore = useUserStore()
  const userUid = computed(() => userStore.userInfo?.uid ?? '')
  const { downloadFile } = useDownload()
  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false
  const disableHistoryActions = options.disableHistoryActions ?? false
  const activeBubbleEnabled = options.activeBubbleEnabled ?? true
  const avatarClickOpensProfile = options.avatarClickOpensProfile ?? false

  const fileDownload = useChatFileDownload({
    t,
    downloadFile,
    getLocalVideoPath,
    checkVideoDownloaded,
    createWebviewWindow,
    sendWindowPayload
  })

  /** 滚动条位置 */
  const scrollTop = ref(-1)
  /** 选中的气泡消息 */
  const activeBubble = ref('')
  /** 记录历史消息下标 */
  const historyIndex = ref(0)
  /** 当前点击的用户的key */
  const selectKey = ref()

  /** 撤回确认弹窗（抽离到 useMsgRecallConfirm） */
  const { tips, modalShow, openRecallConfirm, handleConfirm } = useMsgRecallConfirm()

  /** 消息复制（抽离到 useChatCopy） */
  const { handleCopy } = useChatCopy()

  /** 右键菜单工厂（抽离到 useChatContextMenus） */
  const { commonMenuList, videoMenuList, specialMenuList, optionsList, report, handleItemType } = useChatContextMenus({
    isHistoryMode,
    disableHistoryActions,
    downloadFile,
    fileDownload,
    handleCopy
  })

  /** 修改群昵称弹窗（抽离到 useGroupNicknameModal） */
  const {
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm
  } = useGroupNicknameModal({
    userUid,
    t,
    enableMitt: enableGroupNicknameModal
  })

  const emojiList = computed(() => createEmojiList(t))

  let activeKeyPressListener: ((e: KeyboardEvent) => void) | null = null

  const removeKeyPressListener = () => {
    if (activeKeyPressListener) {
      document.removeEventListener('keydown', activeKeyPressListener)
      activeKeyPressListener = null
    }
  }

  /** 点击气泡消息时候监听用户是否按下ctrl+c来复制内容 */
  const handleMsgClick = (item: MessageType) => {
    if (item.message.type === MsgEnum.VIDEO_CALL) {
      startRtcCall(CallTypeEnum.VIDEO)
      return
    } else if (item.message.type === MsgEnum.AUDIO_CALL) {
      startRtcCall(CallTypeEnum.AUDIO)
      return
    }

    // 移动端宿主会关掉 active 效果（activeBubbleEnabled=false）
    if (activeBubbleEnabled) {
      if (chatStore.msgMultiChooseMode === 'forward') {
        activeBubble.value = ''
      } else {
        activeBubble.value = item.message.id
      }
    }

    // 先移除可能残留的监听，避免重复绑定
    removeKeyPressListener()

    // 启用键盘监听
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'c') || (e.metaKey && e.key === 'c')) {
        // 优先复制用户选中的文本，如果没有选中则复制整个消息内容
        // 对于图片或其他类型的消息，优先使用 url 字段
        const contentToCopy = item.message.body.url || item.message.body.content
        handleCopy(contentToCopy, true, item.message.id)
        // 取消监听键盘事件，以免多次绑定
        removeKeyPressListener()
      }
    }
    activeKeyPressListener = handleKeyPress
    // 绑定键盘事件到 document
    document.addEventListener('keydown', handleKeyPress)
  }

  onUnmounted(() => {
    removeKeyPressListener()
  })

  return {
    handleMsgClick,
    handleConfirm,
    openRecallConfirm,
    handleItemType,
    handleCopy,
    videoMenuList,
    getSelectedText,
    hasSelectedText,
    clearSelection,
    historyIndex,
    tips,
    modalShow,
    specialMenuList,
    optionsList,
    report,
    selectKey,
    emojiList,
    commonMenuList,
    scrollTop,
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm,
    activeBubble,
    avatarClickOpensProfile
  }
}

type UseChatMainContext = ReturnType<typeof useChatMain>
export const chatMainInjectionKey = Symbol('chatMainInjectionKey') as InjectionKey<UseChatMainContext>
