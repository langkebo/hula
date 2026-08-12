/**
 * Shared types and interfaces for the Matrix thread subsystem.
 *
 * Extracted from MatrixThreadService.ts to enable collaborative class split
 * (MatrixThreadApi / MatrixThreadState / threadUtils) without circular imports.
 */

type MsgType = string

export interface IContent {
  [key: string]: unknown
}

export interface RelatesTo {
  rel_type: string
  event_id?: string
  'm.in_reply_to'?: {
    event_id?: string
  }
}

export interface MessageContent {
  msgtype?: MsgType
  body: string
  format?: string
  formatted_body?: string
  'm.relates_to'?: RelatesTo
  mute?: boolean
  frozen?: boolean
  freeze?: boolean
  [key: string]: unknown
}

export interface Thread {
  id: string
  rootEventId: string
  roomId: string
  replyCount: number
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
    content: IContent
  }
  participants: string[]
}

export interface ThreadMessage {
  eventId: string
  sender: string
  content: IContent
  timestamp: number
  inReplyTo?: string
}

export interface ThreadDisplayMessage {
  eventId: string
  sender: string
  senderName: string
  avatarUrl?: string
  content: string
  timestamp: number
  inReplyTo?: string
}

export interface ThreadViewData {
  thread: Thread | null
  rootMessage: ThreadDisplayMessage | null
  replies: ThreadDisplayMessage[]
}

export interface ThreadListItem {
  id: string
  roomId: string
  threadId: string
  rootEventId: string
  rootSender: string
  rootContent: unknown
  rootOriginServerTs: number
  latestEventId: string
  latestSender: string
  latestContent: unknown
  latestOriginServerTs: number
  replyCount: number
  participants: string[]
  isFrozen: boolean
  createdTs: number
  updatedTs?: number
}

export interface ThreadStatistics {
  totalReplies: number
  totalParticipants: number
  totalEdits: number
  totalRedactions: number
  firstReplyTs?: number
  lastReplyTs?: number
  avgReplyTimeMs?: number
}

export interface ThreadSubscription {
  notificationLevel: string
  isMuted: boolean
  subscribedTs?: number
}

export interface ThreadingManagerCompat {
  getGlobalThreadList?: (
    limit?: number,
    from?: string
  ) => Promise<{ threads: unknown[]; next_batch?: string; total: number }>
  createGlobalThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getSubscribedThreads?: () => Promise<unknown[]>
  getGlobalUnreadThreads?: () => Promise<unknown[]>
  createRoomThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getRoomThreadList?: (
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => Promise<{ threads: ThreadListItem[]; next_batch?: string }>
  searchRoomThreads?: (roomId: string, query: string, limit?: number) => Promise<ThreadListItem[]>
  getRoomUnreadThreads?: (roomId: string) => Promise<unknown[]>
  getRoomThread?: (
    roomId: string,
    threadId: string,
    includeReplies?: boolean,
    replyLimit?: number
  ) => Promise<Record<string, unknown> | null>
  deleteRoomThread?: (roomId: string, threadId: string) => Promise<void>
  freezeThread?: (roomId: string, threadId: string) => Promise<void>
  unfreezeThread?: (roomId: string, threadId: string) => Promise<void>
  addThreadReply?: (
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ) => Promise<Record<string, unknown>>
  getThreadReplies?: (roomId: string, threadId: string) => Promise<unknown[]>
  subscribeToThread?: (roomId: string, threadId: string, notificationLevel: string) => Promise<ThreadSubscription>
  unsubscribeFromThread?: (roomId: string, threadId: string) => Promise<void>
  muteThread?: (roomId: string, threadId: string) => Promise<ThreadSubscription>
  markThreadRead?: (
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs: number
  ) => Promise<Record<string, unknown>>
  getThreadStats?: (roomId: string, threadId: string) => Promise<ThreadStatistics | null>
  redactThreadReply?: (roomId: string, eventId: string) => Promise<void>
  getLegacyRoomThreadList?: (
    userId: string,
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => Promise<{ chunk: unknown[]; next_batch?: string }>
}
