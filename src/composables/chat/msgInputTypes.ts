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
import type { UserItem, VoiceBody } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'

export interface ReplyState {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

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
  httpUrl?: string
  mxcUrl?: string
  filename?: string
  eventId?: string
  encryptedFile?: EncryptedAttachmentFile
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
  uploadVoiceToMatrix: (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ) => Promise<VoiceUploadResult>
  isBurnAfterRead: ComputedRef<boolean>
  burnDuration: ComputedRef<number>
}

export type { VoiceBody }

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
