import { reactive, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'

interface ThreadOriginalMessage {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string
  content: string
  timestamp: number
}

export function useChatDialogs(getMessageSenderUid: (msg: MessageType) => string) {
  const _logger = createLogger('useChatDialogs')
  const chatStore = useChatStore()

  // Thread panel state
  const threadPanelVisible = ref(false)
  const activeThreadId = ref('')
  const threadOriginalMessage = ref<ThreadOriginalMessage | null>(null)

  // Event report state
  const eventReportVisible = ref(false)
  const eventReportData = reactive({
    eventId: '',
    roomId: '',
    eventContent: ''
  })

  const handleOpenThread = ({ eventId }: { eventId: string; roomId?: string }) => {
    activeThreadId.value = eventId
    const msg = chatStore.chatMessageList.find((m) => m.message.id === eventId)
    if (msg) {
      const bodyContent =
        typeof msg.message.body === 'object' && msg.message.body !== null
          ? (msg.message.body as { content?: string }).content
          : msg.message.body
      threadOriginalMessage.value = {
        id: msg.message.id,
        senderId: getMessageSenderUid(msg),
        senderName: msg.fromUser.username ?? '',
        senderAvatar: msg.fromUser.avatar ?? '',
        content: typeof bodyContent === 'string' ? bodyContent : '',
        timestamp: msg.message.sendTime
      }
    }
    threadPanelVisible.value = true
  }

  useMitt.on(MittEnum.OPEN_THREAD, handleOpenThread)

  useMitt.on(MittEnum.OPEN_EVENT_REPORT, (payload: unknown) => {
    const data = payload as { roomId: string; eventId: string; eventContent?: string }
    if (data.roomId && data.eventId) {
      eventReportData.eventId = data.eventId
      eventReportData.roomId = data.roomId
      eventReportData.eventContent = data.eventContent || ''
      eventReportVisible.value = true
    }
  })

  return {
    threadPanelVisible,
    activeThreadId,
    threadOriginalMessage,
    eventReportVisible,
    eventReportData
  }
}
