export const MATRIX_PATHS = {
  AUTH: {
    LOGIN: '/_matrix/client/v3/login',
    LOGOUT: '/_matrix/client/v3/logout',
    REFRESH: '/_matrix/client/v3/refresh',
    REGISTER: '/_matrix/client/v3/register',
    WHOAMI: '/_matrix/client/v3/account/whoami',
    CAPABILITIES: '/_matrix/client/v3/capabilities',
    PASSWORD_CHANGE: '/_matrix/client/v3/account/password',
    DEACTIVATE: '/_matrix/client/v3/account/deactivate',
    EMAIL_REQUEST_TOKEN: '/_matrix/client/v3/account/3pid/email/requestToken',
    CAPTCHA_SEND: '/_matrix/client/v3/register/captcha/send',
    CAPTCHA_VERIFY: '/_matrix/client/v3/register/captcha/verify',
    CAPTCHA_STATUS: '/_matrix/client/v3/register/captcha/status',
    CAPTCHA_CLEAN: '/_matrix/client/v3/register/captcha/clean'
  },
  ROOM: {
    CREATE: '/_matrix/client/v3/createRoom',
    CREATE_PRIVATE: '/_matrix/client/v3/rooms/create_private',
    MESSAGES: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/messages`,
    STATE: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/state`,
    MEMBERS: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/members`,
    SEND_EVENT: (roomId: string, eventType: string, txnId: string) =>
      `/_matrix/client/v3/rooms/${roomId}/send/${eventType}/${txnId}`,
    RECEIPT: (roomId: string, receiptType: string, eventId: string) =>
      `/_matrix/client/v3/rooms/${roomId}/receipt/${receiptType}/${eventId}`,
    TYPING: (roomId: string, userId: string) => `/_matrix/client/v3/rooms/${roomId}/typing/${userId}`,
    REDACT: (roomId: string, eventId: string, txnId: string) =>
      `/_matrix/client/v3/rooms/${roomId}/redact/${eventId}/${txnId}`,
    INVITE: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/invite`,
    JOIN: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/join`,
    LEAVE: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/leave`,
    CONTEXT: (roomId: string, eventId: string) => `/_matrix/client/v3/rooms/${roomId}/context/${eventId}`,
    TAGS: (roomId: string) => `/_matrix/client/v3/user/{userId}/rooms/${roomId}/tags`,
    INVITE_BLOCKLIST: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/invite_blocklist`,
    INVITE_ALLOWLIST: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/invite_allowlist`,
    STICKY_EVENTS: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/sticky_events`,
    STICKY_EVENT_BY_TYPE: (roomId: string, eventType: string) =>
      `/_matrix/client/v3/rooms/${roomId}/sticky_events/${eventType}`,
    ANTI_SCREENSHOT: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/anti_screenshot`,
    SUMMARY: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/summary`,
    SUMMARY_MEMBERS: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/summary/members`,
    SUMMARY_STATE: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/summary/state`,
    SUMMARY_STATS: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/summary/stats`,
    EPHEMERAL: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/ephemeral`,
    TIMESTAMP_TO_EVENT: (roomId: string) => `/_matrix/client/v1/rooms/${roomId}/timestamp_to_event`,
    REPORT_SCANNER_INFO: (roomId: string, eventId: string) =>
      `/_matrix/client/v1/rooms/${roomId}/report/${eventId}/scanner_info`
  },
  BURN: {
    STATS: '/_matrix/client/v3/user/burn/stats',
    ROOM_BURN: (roomId: string) => `/_matrix/client/v3/rooms/${roomId}/burn`
  },
  FRIENDS: {
    LIST: '/_matrix/client/v1/friends',
    REQUEST: '/_matrix/client/v1/friends/request',
    SEARCH: '/_matrix/client/v1/friends/search',
    INCOMING_REQUESTS: '/_matrix/client/v1/friends/requests/incoming',
    OUTGOING_REQUESTS: '/_matrix/client/v1/friends/requests/outgoing',
    ACCEPT: (userId: string) => `/_matrix/client/v1/friends/request/${userId}/accept`,
    REJECT: (userId: string) => `/_matrix/client/v1/friends/request/${userId}/reject`,
    REMOVE: (userId: string) => `/_matrix/client/v1/friends/${userId}`,
    NOTE: (userId: string) => `/_matrix/client/v1/friends/${userId}/note`,
    CHECK: (userId: string) => `/_matrix/client/v1/friends/check/${userId}`,
    DM: (userId: string) => `/_matrix/client/v1/friends/dm/${userId}`,
    STATUS: (userId: string) => `/_matrix/client/v1/friends/${userId}/status`
  },
  CRYPTO: {
    KEYS_UPLOAD: '/_matrix/client/v3/keys/upload',
    KEYS_QUERY: '/_matrix/client/v3/keys/query',
    KEYS_CLAIM: '/_matrix/client/v3/keys/claim',
    KEYS_CHANGES: '/_matrix/client/v3/keys/changes',
    DEVICE_SIGNING_UPLOAD: '/_matrix/client/v3/keys/device_signing/upload',
    SIGNATURES_UPLOAD: '/_matrix/client/v3/keys/signatures/upload',
    SEND_TO_DEVICE: (eventType: string, txnId: string) => `/_matrix/client/v3/sendToDevice/${eventType}/${txnId}`,
    SECURE_BACKUP: '/_matrix/client/v3/keys/backup/secure',
    SECURE_BACKUP_BY_ID: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}`,
    SECURE_BACKUP_KEYS: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}/keys`,
    SECURE_BACKUP_RESTORE: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}/restore`,
    SECURE_BACKUP_VERIFY: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}/verify`,
    ROOM_KEYS_VERSION: '/_matrix/client/v3/room_keys/version',
    ROOM_KEYS_VERSION_BY_ID: (version: string) => `/_matrix/client/v3/room_keys/version/${version}`,
    ROOM_KEYS_KEYS: '/_matrix/client/v3/room_keys/keys',
    ROOM_KEYS_KEYS_BY_ROOM: (roomId: string) => `/_matrix/client/v3/room_keys/keys/${roomId}`,
    ROOM_KEYS_KEYS_BY_SESSION: (roomId: string, sessionId: string) =>
      `/_matrix/client/v3/room_keys/keys/${roomId}/${sessionId}`,
    ROOM_KEYS_RECOVER: '/_matrix/client/v3/room_keys/recover',
    ROOM_KEYS_RECOVERY_PROGRESS: (version: string) => `/_matrix/client/v3/room_keys/recovery/${version}/progress`,
    ROOM_KEYS_VERIFY: (version: string) => `/_matrix/client/v3/room_keys/verify/${version}`,
    ROOM_KEYS_BATCH_RECOVER: '/_matrix/client/v3/room_keys/batch_recover',
    ROOM_KEYS_RECOVER_ROOM: (version: string, roomId: string) =>
      `/_matrix/client/v3/room_keys/recover/${version}/${roomId}`,
    ROOM_KEYS_RECOVER_SESSION: (version: string, roomId: string, sessionId: string) =>
      `/_matrix/client/v3/room_keys/recover/${version}/${roomId}/${sessionId}`,
    ROOM_KEYS_EXPORT: (version?: string) =>
      version ? `/_matrix/client/v3/room_keys/export/${version}` : '/_matrix/client/v3/room_keys/export',
    ROOM_KEYS_IMPORT: (version?: string) =>
      version ? `/_matrix/client/v3/room_keys/import/${version}` : '/_matrix/client/v3/room_keys/import',
    ROOM_KEYS_REQUEST: '/_matrix/client/v3/room_keys/request',
    VERIFY_START: '/_matrix/client/v1/keys/device_signing/verify_start',
    VERIFY_ACCEPT: '/_matrix/client/v1/keys/device_signing/verify_accept',
    VERIFY_KEY_AGREEMENT: '/_matrix/client/v1/keys/device_signing/verify_key_agreement',
    VERIFY_MAC: '/_matrix/client/v1/keys/device_signing/verify_mac',
    VERIFY_DONE: '/_matrix/client/v1/keys/device_signing/verify_done',
    VERIFY_CANCEL: '/_matrix/client/v1/keys/device_signing/verify_cancel',
    VERIFY_REQUESTS: '/_matrix/client/v1/keys/device_signing/requests',
    QR_CODE_SHOW: '/_matrix/client/v1/keys/qr_code/show',
    QR_CODE_SCAN: '/_matrix/client/v1/keys/qr_code/scan',
    KEY_ROTATION_STATUS: '/_matrix/client/v1/keys/rotation/status',
    KEY_ROTATION_CHECK: '/_matrix/client/v1/keys/rotation/check',
    KEY_ROTATION_ROTATE: '/_matrix/client/v1/keys/rotation/rotate',
    KEY_ROTATION_HISTORY: (deviceId: string) => `/_matrix/client/v1/keys/rotation/history/${deviceId}`,
    KEY_ROTATION_REVOKE: '/_matrix/client/v1/keys/rotation/revoke',
    KEY_ROTATION_CONFIG: '/_matrix/client/v1/keys/rotation/config'
  },
  DEHYDRATED_DEVICE: {
    BASE: '/_matrix/client/v1/dehydrated_device',
    BY_ID: (deviceId: string) => `/_matrix/client/v1/dehydrated_device/${deviceId}`,
    CLAIM: (deviceId: string) => `/_matrix/client/v1/dehydrated_device/${deviceId}/claim`,
    INITIAL_DEVICE: (deviceId: string) => `/_matrix/client/v1/dehydrated_device/${deviceId}/initial_device`
  },
  SPACE: {
    HIERARCHY: (spaceId: string) => `/_matrix/client/v1/spaces/${spaceId}/hierarchy`,
    HIERARCHY_V1: (spaceId: string) => `/_matrix/client/v1/spaces/${spaceId}/hierarchy/v1`,
    ROOM_HIERARCHY: (spaceId: string) => `/_matrix/client/v1/rooms/${spaceId}/hierarchy`
  },
  AI: {
    CONNECTIONS: '/_matrix/client/v1/ai/connections',
    CONNECTION_BY_ID: (id: string) => `/_matrix/client/v1/ai/connections/${id}`,
    MCP_TOOLS: '/_matrix/client/v1/mcp/tools',
    MCP_TOOLS_CALL: '/_matrix/client/v1/mcp/tools/call'
  },
  SYNC: {
    SYNC: '/_matrix/client/v3/sync',
    FILTER: (userId: string) => `/_matrix/client/v3/user/${userId}/filter`,
    FILTER_BY_ID: (userId: string, filterId: string) => `/_matrix/client/v3/user/${userId}/filter/${filterId}`,
    SLIDING_SYNC: '/_matrix/client/unstable/org.matrix.msc3575/sync'
  },
  NOTIFICATION: {
    PUSH_RULES: '/_matrix/client/v3/pushrules/',
    NOTIFICATIONS: '/_matrix/client/v3/notifications',
    PUSHERS: '/_matrix/client/v3/pushers'
  },
  MEDIA: {
    UPLOAD: '/_matrix/media/v3/upload',
    CONFIG: '/_matrix/media/v3/config',
    DELETE: (serverName: string, mediaId: string) => `/_matrix/media/v3/delete/${serverName}/${mediaId}`,
    QUOTA_ALERTS: '/_matrix/media/v1/quota/alerts',
    QUOTA_CHECK: '/_matrix/media/v1/quota/check',
    QUOTA_STATS: '/_matrix/media/v1/quota/stats',
    CLIENT_MEDIA_CONFIG: '/_matrix/client/v1/media/config',
    PREVIEW_URL: '/_matrix/media/r0/preview_url',
    DOWNLOAD_PREFIX: '/_matrix/media/r0/download/',
    MEDIA_PREFIX: '/_matrix/media/'
  },
  USER: {
    PROFILE: (userId: string) => `/_matrix/client/v3/profile/${userId}`,
    DISPLAYNAME: (userId: string) => `/_matrix/client/v3/profile/${userId}/displayname`,
    AVATAR: (userId: string) => `/_matrix/client/v3/profile/${userId}/avatar_url`,
    DIRECTORY_SEARCH: '/_matrix/client/v3/user_directory/search',
    PRESENCE: (userId: string) => `/_matrix/client/v3/presence/${userId}/status`,
    DEVICES: '/_matrix/client/v3/devices',
    TURN_SERVER: '/_matrix/client/v3/voip/turnServer',
    PUBLIC_ROOMS: '/_matrix/client/v3/publicRooms'
  },
  ADMIN: {
    SYNAPSE_ADMIN_BASE: '/_synapse/admin/v1',
    SERVER_INFO: '/_synapse/admin/v1/server',
    SERVER_VERSION: '/_synapse/admin/v1/server_version',
    WHOAMI: '/_synapse/admin/v1/whoami',
    WHOIS: (userId: string) => `/_synapse/admin/v1/whois/${userId}`,
    USERS: '/_synapse/admin/v2/users',
    ROOMS: '/_synapse/admin/v1/rooms',
    REGISTRATION_TOKENS: '/_synapse/admin/v1/registration_tokens',
    FEDERATION_DESTINATIONS: '/_synapse/admin/v1/federation/destinations',
    CAPTCHA_CLEANUP: '/_synapse/admin/v1/captcha/cleanup',
    EXTERNAL_SERVICES: '/_synapse/admin/v1/external_services',
    REPORTS: '/_synapse/admin/v1/reports',
    REPORT_BY_ID: (reportId: string) => `/_synapse/admin/v1/reports/${reportId}`,
    SERVER_NOTIFICATIONS: '/_synapse/admin/v1/server_notifications',
    SERVER_NOTIFICATION_BY_ID: (id: string) => `/_synapse/admin/v1/server_notifications/${id}`,
    SERVER_NOTIFICATIONS_ACTIVE: '/_synapse/admin/v1/server_notifications/active',
    SERVER_NOTIFICATION_READ: (id: string) => `/_synapse/admin/v1/server_notifications/${id}/read`,
    SERVER_NOTIFICATION_DISMISS: (id: string) => `/_synapse/admin/v1/server_notifications/${id}/dismiss`,
    SERVER_NOTIFICATION_TEMPLATES: '/_synapse/admin/v1/server_notifications/templates',
    APPSERVICES: '/_synapse/admin/v1/appservices',
    APPSERVICE_BY_ID: (id: string) => `/_synapse/admin/v1/appservices/${id}`,
    MATRIX_WHOAMI: '/_matrix/admin/v1/whoami',
    MATRIX_EXTERNAL_SERVICES: '/_matrix/admin/v1/external_services'
  },
  VOICE: {
    CONFIG: '/_matrix/client/v1/voice/config',
    STATS: '/_matrix/client/v1/voice/stats',
    ROOM_STATS: (roomId: string) => `/_matrix/client/v1/voice/room/${roomId}/stats`,
    UPLOAD: '/_matrix/client/v1/voice/upload',
    ROOM_LIST: (roomId: string) => `/_matrix/client/v1/voice/room/${roomId}`,
    USER_LIST: (userId: string) => `/_matrix/client/v1/voice/user/${userId}`,
    USER_STATS: (userId: string) => `/_matrix/client/v1/voice/user/${userId}/stats`,
    CONTENT: (messageId: string) => `/_matrix/client/v1/voice/${messageId}`,
    CONVERT: '/_matrix/client/v1/voice/convert',
    OPTIMIZE: '/_matrix/client/v1/voice/optimize',
    TRANSCRIPTION: '/_matrix/client/v1/voice/transcription'
  },
  FEDERATION: {
    VERSION: '/_matrix/federation/v1/version'
  },
  WELL_KNOWN: {
    CLIENT: '/.well-known/matrix/client',
    SERVER: '/.well-known/matrix/server',
    OIDC_DISCOVERY: '/.well-known/openid-configuration'
  },
  CLIENT_CONFIG: {
    CLIENT: '/_matrix/client/v1/config/client'
  }
} as const
