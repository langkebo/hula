export const EVENT_REPORT = {
  /** @deprecated Unused - will be removed in a future version */
  BASE: '/_synapse/admin/v1/event_reports',
  /** @deprecated Unused - will be removed in a future version */
  COUNT: '/_synapse/admin/v1/event_reports/count',
  /** @deprecated Unused - will be removed in a future version */
  STATS: '/_synapse/admin/v1/event_reports/stats',
  /** @deprecated Unused - will be removed in a future version */
  BY_ID: (id: number) => `/_synapse/admin/v1/event_reports/${id}`,
  /** @deprecated Unused - will be removed in a future version */
  BY_EVENT: (eventId: string) => `/_synapse/admin/v1/event_reports/event/${encodeURIComponent(eventId)}`,
  /** @deprecated Unused - will be removed in a future version */
  BY_ROOM: (roomId: string) => `/_synapse/admin/v1/event_reports/room/${encodeURIComponent(roomId)}`,
  /** @deprecated Unused - will be removed in a future version */
  BY_REPORTER: (userId: string) => `/_synapse/admin/v1/event_reports/reporter/${encodeURIComponent(userId)}`,
  /** @deprecated Unused - will be removed in a future version */
  BY_STATUS: (status: string) => `/_synapse/admin/v1/event_reports/status/${encodeURIComponent(status)}`,
  /** @deprecated Unused - will be removed in a future version */
  STATUS_COUNT: (status: string) => `/_synapse/admin/v1/event_reports/status/${encodeURIComponent(status)}/count`,
  /** @deprecated Unused - will be removed in a future version */
  RESOLVE: (id: number) => `/_synapse/admin/v1/event_reports/${id}/resolve`,
  /** @deprecated Unused - will be removed in a future version */
  DISMISS: (id: number) => `/_synapse/admin/v1/event_reports/${id}/dismiss`,
  /** @deprecated Unused - will be removed in a future version */
  ESCALATE: (id: number) => `/_synapse/admin/v1/event_reports/${id}/escalate`,
  /** @deprecated Unused - will be removed in a future version */
  HISTORY: (id: number) => `/_synapse/admin/v1/event_reports/${id}/history`,
  /** @deprecated Unused - will be removed in a future version */
  RATE_LIMIT: (userId: string) => `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}`,
  /** @deprecated Unused - will be removed in a future version */
  RATE_LIMIT_BLOCK: (userId: string) =>
    `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}/block`,
  /** @deprecated Unused - will be removed in a future version */
  RATE_LIMIT_UNBLOCK: (userId: string) =>
    `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}/unblock`
} as const
