import type { ComputedRef, Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import type { createRecallManager } from './recallManager'
import type { useSessionStore } from './session'
import type { MessageType } from './types'

/**
 * 消息写操作的共享依赖。
 *
 * 原先定义在 `messageMutations.ts`（564 行），拆分后单独存放：
 * 插入/更新类与撤回类写操作各自只解构自己需要的字段，类型仍在此处单一维护。
 */
export interface MessageMutationsDeps {
  route: RouteLocationNormalizedLoaded
  userStore: ReturnType<typeof useUserStore>
  groupStore: ReturnType<typeof useGroupStore>
  globalStore: ReturnType<typeof useGlobalStore>
  sessionStore: ReturnType<typeof useSessionStore>
  recallMgr: ReturnType<typeof createRecallManager>

  messageMap: Record<string, Record<string, MessageType>>
  sortedMessageKeys: Record<string, string[]>
  replyMapping: Record<string, Record<string, string[]>>
  messageOptions: Record<string, { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean }>
  newMsgCount: Record<string, { count: number; isStart: boolean }>

  currentMessageMap: ComputedRef<Record<string, MessageType>>
  currentMessageOptions: { value: { isLast: boolean; isLoading: boolean; cursor: string; hasLoadedOnce?: boolean } }
  currentReplyMap: { value: Record<string, string[]> }
  currentMsgReply: Ref<Partial<MessageType>>

  ensureSortedMessageState: (roomId: string) => void
  setSortedMessageKeys: (roomId: string, keys: string[]) => void
  findMessageInsertIndex: (roomId: string, messageKey: string) => number
  getCurrentSortedMessageKeys: (roomId: string) => string[]

  setMessageRoomIndex: (msgId: string, roomId: string) => void
  deleteMessageRoomIndex: (msgId: string) => void
  rebuildMessageRoomIndex: (roomId: string) => void
  findRoomIdByMsgId: (msgId: string) => string

  removeReplyReferences: (roomId: string, sourceMsgId: string) => void
  upsertReplyReference: (roomId: string, sourceMsgId: string, msg?: MessageType) => void
  syncReplyReference: (roomId: string, sourceMsgId: string, msg?: MessageType) => void
  rebuildReplyMapping: (roomId: string) => void
  migrateReplyTargetReferences: (roomId: string, oldMsgId: string, newMsgId: string) => void
}
