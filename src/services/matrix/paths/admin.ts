export const ADMIN = {
  SYNAPSE_ADMIN_BASE: '/_synapse/admin/v1',
  /** @deprecated Use AdminFacadeService or ServerService methods instead */
  SERVER_INFO: '/_synapse/admin/v1/server',
  /** @deprecated Use AdminFacadeService or ServerService methods instead */
  SERVER_VERSION: '/_synapse/admin/v1/server_version',
  /** @deprecated Use AdminFacadeService methods instead */
  WHOAMI: '/_synapse/admin/v1/whoami',
  /** @deprecated Use AdminUserService methods instead */
  WHOIS: (userId: string) => `/_synapse/admin/v1/whois/${encodeURIComponent(userId)}`,
  /** @deprecated Use AdminUserService methods instead */
  USERS: '/_synapse/admin/v2/users',
  /** @deprecated Use AdminRoomService methods instead */
  ROOMS: '/_synapse/admin/v1/rooms',
  /** @deprecated Use RegistrationTokensService methods instead */
  REGISTRATION_TOKENS: '/_synapse/admin/v1/registration_tokens',
  /** @deprecated Use FederationService methods instead */
  FEDERATION_DESTINATIONS: '/_synapse/admin/v1/federation/destinations',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_CLEANUP: '/_synapse/admin/v1/captcha/cleanup',
  EXTERNAL_SERVICES: '/_synapse/admin/v1/external_services',
  REPORTS: '/_synapse/admin/v1/reports',
  REPORT_BY_ID: (reportId: string) => `/_synapse/admin/v1/reports/${encodeURIComponent(reportId)}`,
  SERVER_NOTIFICATIONS: '/_synapse/admin/v1/server_notifications',
  SERVER_NOTIFICATION_BY_ID: (id: string) => `/_synapse/admin/v1/server_notifications/${encodeURIComponent(id)}`,
  SERVER_NOTIFICATIONS_ACTIVE: '/_synapse/admin/v1/server_notifications/active',
  SERVER_NOTIFICATION_READ: (id: string) => `/_synapse/admin/v1/server_notifications/${encodeURIComponent(id)}/read`,
  SERVER_NOTIFICATION_DISMISS: (id: string) =>
    `/_synapse/admin/v1/server_notifications/${encodeURIComponent(id)}/dismiss`,
  SERVER_NOTIFICATION_TEMPLATES: '/_synapse/admin/v1/server_notifications/templates',
  APPSERVICES: '/_synapse/admin/v1/appservices',
  APPSERVICE_BY_ID: (id: string) => `/_synapse/admin/v1/appservices/${encodeURIComponent(id)}`,
  /** @deprecated Use AdminFacadeService methods instead */
  MATRIX_WHOAMI: '/_matrix/admin/v1/whoami',
  MATRIX_EXTERNAL_SERVICES: '/_matrix/admin/v1/external_services',
  /** Purge remote media cache (admin) — used by AdminMediaService.purgeRemoteMedia */
  PURGE_REMOTE_MEDIA: '/_matrix/client/v1/admin/purge_remote_media'
} as const
