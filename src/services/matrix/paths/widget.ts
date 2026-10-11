export const WIDGET = {
  CAPABILITIES: (roomId: string, widgetId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/widgets/${encodeURIComponent(widgetId)}/capabilities`
} as const
