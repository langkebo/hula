/**
 * Pure utilities for the Matrix thread subsystem.
 *
 * These functions have no class state and no i18n dependency, so they can be
 * shared freely between MatrixThreadService, MatrixThreadApi and MatrixThreadState.
 */

import { MatrixContentField } from '@/common/matrixConstants'
import type { MatrixEvent, Room } from '@/services/matrix/sdk'
import matrixClientService from '../MatrixClientService'
import type {
  MessageContent,
  ThreadDisplayMessage,
  ThreadingManagerCompat,
  ThreadListItem,
  ThreadSummaryResponse
} from './threadTypes'

/**
 * Returns the synapse-rust ThreadingManager extension from the current MatrixClient,
 * or null when the client / manager is unavailable.
 *
 * ⚠️ 访问路径校准：SDK 暴露的是 `MatrixClient.prototype.getThreadingManager()` 方法
 * （由 `extendMatrixClient()` 注入），**不是** `client.threadingManager` 属性。
 * 此前按属性访问恒为 undefined，导致所有线程操作静默降级为 fallback。
 */
export function getThreadingManager(): ThreadingManagerCompat | null {
  const client = matrixClientService.getClient()
  if (!client) return null
  // 优先走 SDK 暴露的 getThreadingManager() 方法；兼容宿主额外挂载的 threadingManager 属性。
  const method = (client as unknown as { getThreadingManager?: () => ThreadingManagerCompat }).getThreadingManager
  if (typeof method === 'function') return method.call(client)
  return (client as unknown as { threadingManager?: ThreadingManagerCompat }).threadingManager ?? null
}

/**
 * SDK `ThreadSummaryResponse`（snake_case，后端原生）→ Tjg `ThreadListItem`（camelCase，展示层）。
 *
 * 线程接口统一透传后端原始形状（见 MatrixThreadApi），展示层需要 camelCase 时调用本函数，
 * 避免在类型镜像层做重命名而再次引入签名漂移。
 */
export function toThreadListItem(summary: ThreadSummaryResponse): ThreadListItem {
  return {
    id: String(summary.thread_id ?? summary.id),
    roomId: summary.room_id,
    threadId: summary.thread_id,
    rootEventId: summary.root_event_id,
    rootSender: summary.root_sender,
    rootContent: summary.root_content,
    rootOriginServerTs: summary.root_origin_server_ts,
    latestEventId: summary.latest_event_id ?? '',
    latestSender: summary.latest_sender ?? '',
    latestContent: summary.latest_content,
    latestOriginServerTs: summary.latest_origin_server_ts ?? 0,
    replyCount: summary.reply_count,
    participants: Array.isArray(summary.participants) ? (summary.participants as string[]) : [],
    isFrozen: summary.is_frozen,
    createdTs: summary.created_ts,
    updatedTs: summary.updated_ts
  }
}

/**
 * Builds a display-ready message snapshot from a timeline event, resolving the
 * sender display name and avatar from the room member state.
 */
export function buildDisplayMessage(room: Room, event: MatrixEvent): ThreadDisplayMessage {
  const sender = event.getSender() || ''
  const member = room.getMember(sender)
  const content = event.getContent() as MessageContent

  return {
    eventId: event.getId() || '',
    sender,
    senderName: member?.name || sender,
    avatarUrl: member?.getMxcAvatarUrl() || undefined,
    content: content.body || '',
    timestamp: event.getTs(),
    inReplyTo: content?.[MatrixContentField.RELATES_TO]?.['m.in_reply_to']?.event_id
  }
}
