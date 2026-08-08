import type { Ref } from 'vue'
import { computed, nextTick, ref, watchEffect } from 'vue'
import { useMessageSender } from '@/composables/chat/useMessageSender'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import type { AIModel } from '@/services/types.ts'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { useCommon } from '../common/useCommon'
import { useTrigger } from '../common/useTrigger'
import { parseHtmlSafely } from './mentionParser'
import { useClipboardPaste } from './useClipboardPaste'
import { useCursorManager } from './useCursorManager'
import { useInputShortcuts } from './useInputShortcuts'
import { useMentionState } from './useMentionState'
import { useMsgInputEvents } from './useMsgInputEvents'
import { useMsgInputMentionActions } from './useMsgInputMentionActions'
import { useMsgInputSend } from './useMsgInputSend'
import { useVoiceInput } from './useVoiceInput'

const logger = createLogger('MsgInput')

export const useMsgInput = (messageInputDom: Ref) => {
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const { getCursorSelectionRange, updateSelectionRange, focusOn } = useCursorManager()
  const { triggerInputEvent, insertNode, getMessageContentType, getEditorRange, imgPaste, reply, userUid } = useCommon()

  const settingStore = useSettingStore()
  const sendKey = computed(() => settingStore.sendMessageShortcut)
  /** 输入框内容  */
  const msgInput = ref('')
  /** 发送按钮是否禁用 */
  const disabledSend = computed(() => {
    const plainText = stripHtml(msgInput.value)
    return (
      plainText.length === 0 ||
      plainText
        .replace(/&nbsp;/g, ' ')
        .replace(/ /g, ' ')
        .trim().length === 0
    )
  })
  /** 是否正在输入拼音 */
  const isChinese = ref(false)
  const groupUserList = computed(() => groupStore.userList)
  const { ait, aitKey, personList, selectedAitKey } = useMentionState(groupUserList, userUid, isChinese)
  // AI弹出框
  const aiDialogVisible = ref(false)
  const aiKeyword = ref('')
  const aiModelList = ref<AIModel[]>([
    {
      uid: '1',
      type: 'Ollama',
      name: 'DeepSeek-Chat',
      value: 'deepseek-chat',
      avatar: '/AI/deepseek.png'
    },
    {
      uid: '1b',
      type: 'Ollama',
      name: 'DeepSeek-Reasoner',
      value: 'deepseek-reasoner',
      avatar: '/AI/deepseek.png'
    },
    {
      uid: '2',
      type: 'Ollama',
      name: '通义千问-Plus',
      value: 'qwen-plus',
      avatar: '/AI/QW.png'
    },
    {
      uid: '3',
      type: 'OpenAI',
      name: 'ChatGPT-4',
      value: 'ChatGPT-4',
      avatar: '/AI/openai.svg'
    }
  ])
  const groupedAIModels = computed(() => {
    if (aiKeyword.value && !isChinese.value) {
      return aiModelList.value.filter((i) => i.name?.startsWith(aiKeyword.value))
    }
    return aiModelList.value
  })
  const selectedAIKey = ref<string | null>(groupedAIModels.value[0]?.uid ?? null)

  // #话题弹出框
  const topicDialogVisible = ref(false)
  const topicKeyword = ref('')
  const topicList = ref([
    { uid: '1', label: '话题1', value: '话题1' },
    { uid: '2', label: '话题2', value: '话题2' }
  ])

  /** 右键菜单列表（粘贴逻辑抽离至 useClipboardPaste） */
  const { menuList } = useClipboardPaste({
    messageInputDom,
    imgPaste,
    insertNode,
    triggerInputEvent
  })

  const { handleTrigger, resetAllStates } = useTrigger(
    personList,
    groupedAIModels,
    topicList,
    ait,
    aitKey,
    aiDialogVisible,
    aiKeyword,
    topicDialogVisible,
    topicKeyword
  )

  watchEffect(() => {
    if (groupedAIModels.value.length === 0) {
      selectedAIKey.value = null
      aiDialogVisible.value = false
    } else if (!aiDialogVisible.value) {
      selectedAIKey.value = groupedAIModels.value[0]?.uid
    }
    // 输入框为空则清空回复
    if (msgInput.value === '') {
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }
    }
  })

  /** 去除html标签（用于判断回复时是否有输入内容） */
  const stripHtml = (html: string): string => {
    try {
      if (html.includes('data-type="emoji"')) {
        const doc = parseHtmlSafely(html)
        const imgElement = doc?.querySelector<HTMLImageElement>('img[data-type]')
        if (imgElement) {
          const serverUrl = imgElement.dataset?.serverUrl
          if (serverUrl) return (msgInput.value = serverUrl)
          if (imgElement.src) return (msgInput.value = imgElement.src)
        }
      }
      if (html.includes('data-type="video"')) return html

      const doc = parseHtmlSafely(html)
      if (!doc?.body) {
        let sanitized = html
        let previous
        do {
          previous = sanitized
          sanitized = sanitized.replace(/<[^>]*>/g, '')
        } while (sanitized !== previous)
        return sanitized.trim()
      }

      if (doc.querySelector('#temp-image')) return 'image'

      const textContent = doc.body.textContent?.trim()
      if (textContent) return textContent
      return (doc.body as HTMLElement).innerText?.trim?.() ?? ''
    } catch (error) {
      logger.error('Error in stripHtml:', error)
      return ''
    }
  }

  /** 重置输入框内容 */
  const resetInput = () => {
    try {
      msgInput.value = ''
      messageInputDom.value.innerHTML = ''
      messageInputDom.value.textContent = ''
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }
    } catch (error) {
      logger.error('Error in resetInput:', error)
    }
  }

  /** 输入框快捷键 / 发送键 / 防抖输入 */
  const { chatKey, handleInput, inputKeyDown } = useInputShortcuts({
    messageInputDom,
    msgInput,
    sendKey,
    setSendKey: settingStore.setSendMessageShortcut,
    ait,
    aiDialogVisible,
    isChinese,
    disabledSend,
    getEditorRange,
    handleTrigger,
    resetAllStates,
    resetInput,
    insertNode,
    triggerInputEvent
  })

  const { sendWithTracking } = useMessageSender()
  const burnAfterRead = useBurnAfterRead()
  const isBurnAfterRead = computed(() => burnAfterRead.isRoomBurnEnabled())
  const burnDuration = computed(() => burnAfterRead.getRoomBurnDuration())
  const { uploadVoiceToMatrix } = useVoiceInput()
  const {
    send: sendCore,
    sendFilesDirect,
    sendVoiceDirect,
    sendBeaconDirect,
    sendLinkPreviewDirect,
    sendLocationDirect,
    sendEmojiDirect
  } = useMsgInputSend({
    messageInputDom,
    msgInput,
    reply,
    userUid,
    globalStore,
    groupStore,
    chatStore,
    getMessageContentType,
    resetInput,
    sendWithTracking,
    uploadVoiceToMatrix,
    isBurnAfterRead,
    burnDuration
  })

  const send = async () => {
    await sendCore()
    if (isMobile()) {
      nextTick(() => {
        focusOn(messageInputDom.value)
      })
    }
  }

  /** @ 提及 / `/` 命令动作 */
  const { handleAit, handleAI } = useMsgInputMentionActions({
    messageInputDom,
    isChinese,
    ait,
    aiDialogVisible,
    groupStore,
    focusOn,
    getEditorRange,
    insertNode,
    triggerInputEvent
  })

  /** 生命周期事件：RE_EDIT / REPLY_MEG / composition */
  useMsgInputEvents({
    messageInputDom,
    msgInput,
    reply,
    isChinese,
    aitKey,
    aiKeyword,
    groupStore,
    focusOn,
    triggerInputEvent
  })

  return {
    imgPaste,
    inputKeyDown,
    handleAit,
    handleAI,
    handleInput,
    send,
    stripHtml,
    sendLocationDirect,
    sendFilesDirect,
    sendVoiceDirect,
    sendBeaconDirect,
    sendLinkPreviewDirect,
    sendEmojiDirect,
    personList,
    ait,
    aitKey,
    msgInput,
    chatKey,
    menuList,
    selectedAitKey,
    reply,
    disabledSend,
    aiDialogVisible,
    aiKeyword,
    aiModelList,
    selectedAIKey,
    topicDialogVisible,
    topicKeyword,
    topicList,
    groupedAIModels,
    getCursorSelectionRange,
    updateSelectionRange: () => updateSelectionRange(getEditorRange()),
    focusOn
  }
}
