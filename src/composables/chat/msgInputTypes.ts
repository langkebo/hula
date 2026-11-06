/**
 * Type definitions and pure utilities for useMsgInputSend.
 *
 * Extracted from useMsgInputSend.ts to keep the main composable under the
 * file size guard. Shared by useMsgInputFileUpload and useMsgInputDirectSend.
 */

import type { ComputedRef, Ref } from 'vue'
import { MessageStatusEnum, type MsgEnum } from '@/enums'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import type { UserItem } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'

export interface ReplyState {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

/**
 * 策略层（getMsg/buildMessageBody）的 reply 形参声明为 `MessageType | null`，
 * 而调用方持有的是 UI 侧的 `ReplyState`，二者结构不重叠。
 * 该交集别名用于在调用点做单次类型断言，替代 `as unknown as`。
 */
export type StrategyReplyArg = ReplyState & MessageType

export interface UserSummary {
  name?: string
  avatar?: string
}

export interface GlobalStoreLike {
  currentSessionRoomId: string
}

export interface GroupStoreLike {
  userList: UserItem[]
  getUserInfo: (uid: string, roomId?: string) => UserSummary | null
}

export interface ChatUpdateMsgPayload {
  msgId: string
  status: MessageStatusEnum
  newMsgId?: string
  body?: Record<string, unknown>
  /** 消息类型（图片上传完成后从占位 FILE 切换为 IMAGE） */
  type?: MsgEnum
  uploadProgress?: number
  timeBlock?: number
  roomId?: string
}

export interface ChatStoreLike {
  pushMsg: (msg: MessageType, options?: { isActiveChatView?: boolean; activeRoomId?: string }) => Promise<void>
  updateMsg: (payload: ChatUpdateMsgPayload) => unknown
  updateSessionLastActiveTime: (roomId: string) => unknown
}

export interface VoiceUploadResult {
  httpUrl?: string | undefined
  mxcUrl?: string | undefined
  filename?: string | undefined
  eventId?: string | undefined
  encryptedFile?: EncryptedAttachmentFile | undefined
}

export interface UseMsgInputSendOptions {
  messageInputDom: Ref<HTMLElement>
  msgInput: Ref<string>
  reply: Ref<ReplyState>
  userUid: Ref<string>
  globalStore: GlobalStoreLike
  groupStore: GroupStoreLike
  chatStore: ChatStoreLike
  getMessageContentType: (messageInputDom: Ref<HTMLElement>) => MsgEnum
  resetInput: () => void
  sendWithTracking: (options: { tempMsgId: string; payload: SendMessagePayload }) => Promise<unknown>
  /** 定时发送委托：返回 true 表示服务端已排期成功。 */
  onScheduleDelayedMessage: (payload: SendMessagePayload, delayMs: number) => Promise<boolean>
  uploadVoiceToMatrix: (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ) => Promise<VoiceUploadResult>
  isBurnAfterRead: ComputedRef<boolean>
  burnDuration: ComputedRef<number>
}

/**
 * Creates a requestAnimationFrame-throttled progress updater that batches
 * upload progress updates to the chat store at most once per throttle window.
 */
export function createRafProgressUpdater(chatStore: ChatStoreLike, msgId: string, throttleMs = 200) {
  let lastTime = 0
  let rafId: number | null = null
  let latestPct = 0

  return (pct: number) => {
    latestPct = pct
    const now = Date.now()

    if (now - lastTime >= throttleMs) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      chatStore.updateMsg({
        msgId,
        status: MessageStatusEnum.SENDING,
        uploadProgress: latestPct
      })
      lastTime = now
    } else if (!rafId) {
      rafId = requestAnimationFrame(() => {
        chatStore.updateMsg({
          msgId,
          status: MessageStatusEnum.SENDING,
          uploadProgress: latestPct
        })
        lastTime = Date.now()
        rafId = null
      })
    }
  }
}

/**
 * Revokes a blob: URL if the given value is a string starting with "blob:".
 */
export function revokeBlobUrl(value: unknown): void {
  if (typeof value === 'string' && value.startsWith('blob:')) {
    URL.revokeObjectURL(value)
  }
}
