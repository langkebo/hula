/**
 * Pure utilities for the Matrix thread subsystem.
 *
 * These functions have no class state and no i18n dependency, so they can be
 * shared freely between MatrixThreadService, MatrixThreadApi and MatrixThreadState.
 */

import { MatrixContentField } from '@/common/matrixConstants'
import type { MatrixEvent, Room } from '@/services/matrix/sdk'
import matrixClientService from '../MatrixClientService'
import type { MessageContent, ThreadDisplayMessage, ThreadingManagerCompat } from './threadTypes'

/**
 * Returns the synapse-rust ThreadingManager extension from the current MatrixClient,
 * or null when the client / manager is unavailable.
 */
export function getThreadingManager(): ThreadingManagerCompat | null {
  const client = matrixClientService.getClient()
  if (!client) return null
  return (client as unknown as { threadingManager?: ThreadingManagerCompat }).threadingManager ?? null
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
