export const EVENT_REPORT = {
  BASE: '/_synapse/admin/v1/event_reports',
  COUNT: '/_synapse/admin/v1/event_reports/count',
  STATS: '/_synapse/admin/v1/event_reports/stats',
  BY_ID: (id: number) => `/_synapse/admin/v1/event_reports/${id}`,
  BY_EVENT: (eventId: string) => `/_synapse/admin/v1/event_reports/event/${encodeURIComponent(eventId)}`,
  BY_ROOM: (roomId: string) => `/_synapse/admin/v1/event_reports/room/${encodeURIComponent(roomId)}`,
  BY_REPORTER: (userId: string) => `/_synapse/admin/v1/event_reports/reporter/${encodeURIComponent(userId)}`,
  BY_STATUS: (status: string) => `/_synapse/admin/v1/event_reports/status/${encodeURIComponent(status)}`,
  STATUS_COUNT: (status: string) => `/_synapse/admin/v1/event_reports/status/${encodeURIComponent(status)}/count`,
  RESOLVE: (id: number) => `/_synapse/admin/v1/event_reports/${id}/resolve`,
  DISMISS: (id: number) => `/_synapse/admin/v1/event_reports/${id}/dismiss`,
  ESCALATE: (id: number) => `/_synapse/admin/v1/event_reports/${id}/escalate`,
  HISTORY: (id: number) => `/_synapse/admin/v1/event_reports/${id}/history`,
  RATE_LIMIT: (userId: string) => `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}`,
  RATE_LIMIT_BLOCK: (userId: string) =>
    `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}/block`,
  RATE_LIMIT_UNBLOCK: (userId: string) =>
    `/_synapse/admin/v1/event_reports/rate_limit/${encodeURIComponent(userId)}/unblock`
} as const
