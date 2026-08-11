import { PREFIX_V1 } from './prefixes'

export const ROOM = {
  /** @deprecated Use CreationService.createRoom() instead */
  CREATE: '/createRoom',
  /** @deprecated Use TimelineService.getMessages() instead */
  MESSAGES: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/messages`,
  /** @deprecated Use StateService.getState() instead */
  STATE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/state`,
  /** @deprecated Use MembershipService.getMembers() instead */
  MEMBERS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/members`,
  /** @deprecated Use MatrixMessageService.send() instead */
  SEND_EVENT: (roomId: string, eventType: string, txnId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`,
  /** @deprecated Use MatrixReceiptService.sendReceipt() instead */
  RECEIPT: (roomId: string, receiptType: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/receipt/${encodeURIComponent(receiptType)}/${encodeURIComponent(eventId)}`,
  /** @deprecated Use MatrixTypingService.setTyping() instead */
  TYPING: (roomId: string, userId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(userId)}`,
  /** @deprecated Use MatrixMessageService.redact() instead */
  REDACT: (roomId: string, eventId: string, txnId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${encodeURIComponent(txnId)}`,
  /** @deprecated Use MembershipService.invite() instead */
  INVITE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/invite`,
  /** @deprecated Use MembershipService.join() instead */
  JOIN: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/join`,
  /** @deprecated Use MembershipService.leave() instead */
  LEAVE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/leave`,
  /** @deprecated Use TimelineService.getContext() instead */
  CONTEXT: (roomId: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`,
  /** @deprecated Use TagsService methods instead */
  TAGS: (roomId: string, userId: string) =>
    `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/tags`,
  ANTI_SCREENSHOT: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/anti_screenshot`,
  SUMMARY_MEMBERS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/summary/members`,
  SUMMARY_STATE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/summary/state`,
  TIMESTAMP_TO_EVENT: (roomId: string) => `${PREFIX_V1}/rooms/${encodeURIComponent(roomId)}/timestamp_to_event`,
  REPORT_SCANNER_INFO: (roomId: string, eventId: string) =>
    `${PREFIX_V1}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/scanner_info`,
  NOTIFICATIONS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/notifications`,
  UNREAD_COUNT: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/unread_count`,
  TIMELINE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/timeline`,
  /** @deprecated Use PinsService methods instead */
  PINNED_EVENTS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/pinned_events`,
  /** @deprecated Use PinsService methods instead */
  PINNED_EVENT_BY_ID: (roomId: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/pinned_events/${encodeURIComponent(eventId)}`,
  /** @deprecated Use RoomCapabilitiesService methods instead */
  CAPABILITIES: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/capabilities`,
  PERMISSIONS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/permissions`,
  /** @deprecated Use AliasesService methods instead */
  ALIASES: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/aliases`,
  /** @deprecated Use LifecycleService.upgradeRoom() instead */
  UPGRADE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/upgrade`,
  /** @deprecated Use MembershipService.knock() instead */
  KNOCK: (roomIdOrAlias: string) => `/knock/${encodeURIComponent(roomIdOrAlias)}`,
  JOIN_BY_ALIAS: (roomIdOrAlias: string) => `/join/${encodeURIComponent(roomIdOrAlias)}`,
  /** @deprecated Use MatrixReceiptService.setReadMarkers() instead */
  READ_MARKERS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/read_markers`,
  METADATA: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/metadata`,
  TURN_SERVER: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/turn_server`,
  ROOM_SYNC: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/sync`,
  CALL: (roomId: string, callId: string) => `/rooms/${encodeURIComponent(roomId)}/call/${encodeURIComponent(callId)}`,
  VAULT_DATA: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/vault_data`,
  /** P2-8 事件签名 (FT-089) */
  SIGN_EVENT: (roomId: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/sign/${encodeURIComponent(eventId)}`,
  /** P2-8 事件验证 (FT-089) */
  VERIFY_EVENT: (roomId: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/verify/${encodeURIComponent(eventId)}`,
  /** P2-6 消息队列状态 (FT-089) */
  MESSAGE_QUEUE: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/message_queue`,
  /** P2-9 加密事件列表扩展 (FT-089) */
  ENCRYPTED_EVENTS: (roomId: string) => `/rooms/${encodeURIComponent(roomId)}/encrypted_events`
} as const
