export const CRYPTO = {
  KEYS_UPLOAD: '/_matrix/client/v3/keys/upload',
  KEYS_QUERY: '/_matrix/client/v3/keys/query',
  KEYS_CLAIM: '/_matrix/client/v3/keys/claim',
  KEYS_CHANGES: '/_matrix/client/v3/keys/changes',
  DEVICE_SIGNING_UPLOAD: '/_matrix/client/v3/keys/device_signing/upload',
  SIGNATURES_UPLOAD: '/_matrix/client/v3/keys/signatures/upload',
  SEND_TO_DEVICE: (eventType: string, txnId: string) => `/_matrix/client/v3/sendToDevice/${eventType}/${txnId}`,
  /** @deprecated Unused - will be removed in a future version */
  SECURE_BACKUP: '/_matrix/client/v3/keys/backup/secure',
  /** @deprecated Unused - will be removed in a future version */
  SECURE_BACKUP_BY_ID: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}`,
  /** @deprecated Unused - will be removed in a future version */
  SECURE_BACKUP_KEYS: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}/keys`,
  /** @deprecated Unused - will be removed in a future version */
  SECURE_BACKUP_RESTORE: (backupId: string) => `/_matrix/client/v3/keys/backup/secure/${backupId}/restore`,
  /** @deprecated Unused - will be removed in a future version */
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
  /** @deprecated Unused - will be removed in a future version */
  KEY_ROTATION_STATUS: '/_matrix/client/v1/keys/rotation/status',
  KEY_ROTATION_CHECK: '/_matrix/client/v1/keys/rotation/check',
  KEY_ROTATION_ROTATE: '/_matrix/client/v1/keys/rotation/rotate',
  KEY_ROTATION_HISTORY: (deviceId: string) =>
    `/_matrix/client/v1/keys/rotation/history/${encodeURIComponent(deviceId)}`,
  KEY_ROTATION_REVOKE: '/_matrix/client/v1/keys/rotation/revoke',
  KEY_ROTATION_CONFIG: '/_matrix/client/v1/keys/rotation/config'
} as const
