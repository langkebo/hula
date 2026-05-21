/**
 * Re-export message types from @/types/message for backward compatibility.
 * New code should import directly from @/types/message.
 */
export type {
  CustomForwardTask,
  MessageBody,
  MessageType,
  RecalledMessage
} from '@/types/message'

export {
  pageSize,
  RECALL_EXPIRATION_TIME,
  ROOM_MESSAGE_CACHE_LIMIT
} from '@/types/message'
