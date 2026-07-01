export type { ForwardResult } from '@/services/matrix/messaging/MatrixForwardService'
export type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
export type {
  Thread,
  ThreadDisplayMessage,
  ThreadListItem,
  ThreadStatistics,
  ThreadSubscription,
  ThreadViewData
} from '@/services/matrix/messaging/MatrixThreadService'
export { openMsgSession, openMsgSessionByRoomId } from './openMsgSession'
export type { AssistantModelPreset } from './useAssistantModelPresets'
export { useAssistantModelPresets } from './useAssistantModelPresets'
export { useAutoScrollGuard } from './useAutoScrollGuard'
export { useChatLayout, useChatLayoutGlobal } from './useChatLayout'
export type { UseChatMainContext } from './useChatMain'
export { chatMainInjectionKey, useChatMain } from './useChatMain'
export { useChatScrollManager } from './useChatScrollManager'
export { useCustomForwardTask } from './useCustomForwardTask'
// Bridge re-exports from @/hooks
export { useMessage } from './useMessage'
export type { SendWithTrackingOptions } from './useMessageSender'
export { useMessageSender } from './useMessageSender'
export { useCursorManager, useMsgInput } from './useMsgInput'
export { useReplaceMsg } from './useReplaceMsg'
export type { RoomUnreadInfo } from './useSlidingSyncRoomList'
export { useSlidingSyncRoomList } from './useSlidingSyncRoomList'
export type { BatchTypingResult, TypingUser } from './useTyping'
export { useTyping } from './useTyping'
export type { VoiceDragControlReturn } from './useVoiceDragControl'
export { useVoiceDragControl } from './useVoiceDragControl'
export { useVoiceRecordRust } from './useVoiceRecordRust'
export type { WaveformColors, WaveformRendererReturn } from './useWaveformRenderer'
export { useWaveformRenderer } from './useWaveformRenderer'
