export const ROOM = {
  CREATE: '/_matrix/client/v3/createRoom',
  MESSAGES: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`,
  STATE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`,
  MEMBERS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members`,
  SEND_EVENT: (roomId: string, eventType: string, txnId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`,
  RECEIPT: (roomId: string, receiptType: string, eventId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/receipt/${encodeURIComponent(receiptType)}/${encodeURIComponent(eventId)}`,
  TYPING: (roomId: string, userId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(userId)}`,
  REDACT: (roomId: string, eventId: string, txnId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(eventId)}/${encodeURIComponent(txnId)}`,
  INVITE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
  JOIN: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
  LEAVE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`,
  CONTEXT: (roomId: string, eventId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`,
  TAGS: (roomId: string) => `/_matrix/client/v3/user/{userId}/rooms/${encodeURIComponent(roomId)}/tags`,
  INVITE_BLOCKLIST: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`,
  INVITE_ALLOWLIST: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`,
  STICKY_EVENTS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`,
  STICKY_EVENT_BY_TYPE: (roomId: string, eventType: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
  ANTI_SCREENSHOT: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/anti_screenshot`,
  SUMMARY: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary`,
  SUMMARY_MEMBERS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/members`,
  SUMMARY_STATE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/state`,
  SUMMARY_STATS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/stats`,
  EPHEMERAL: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/ephemeral`,
  TIMESTAMP_TO_EVENT: (roomId: string) => `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/timestamp_to_event`,
  REPORT_SCANNER_INFO: (roomId: string, eventId: string) =>
    `/_matrix/client/v1/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/scanner_info`,
  NOTIFICATIONS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/notifications`,
  UNREAD_COUNT: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/unread_count`,
  TIMELINE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/timeline`,
  PINNED_EVENTS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/pinned_events`,
  PINNED_EVENT_BY_ID: (roomId: string, eventId: string) =>
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/pinned_events/${encodeURIComponent(eventId)}`,
  CAPABILITIES: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/capabilities`,
  PERMISSIONS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/permissions`,
  ALIASES: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/aliases`,
  VERSION: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/version`,
  UPGRADE: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/upgrade`,
  KNOCK: (roomIdOrAlias: string) => `/_matrix/client/v3/knock/${encodeURIComponent(roomIdOrAlias)}`,
  JOIN_BY_ALIAS: (roomIdOrAlias: string) => `/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`,
  READ_MARKERS: (roomId: string) => `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/read_markers`
} as const
