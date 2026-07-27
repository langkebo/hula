export const RELATIONS = {
  BASE: (roomId: string, eventId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}`,
  BY_TYPE: (roomId: string, eventId: string, relType: string) =>
    `/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}`,
  SEND: (roomId: string, eventId: string, relType: string, txnId: string) =>
    `/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}/${encodeURIComponent(txnId)}`,
  AGGREGATIONS: (roomId: string, eventId: string, relType: string) =>
    `/rooms/${encodeURIComponent(roomId)}/aggregations/${encodeURIComponent(eventId)}/${encodeURIComponent(relType)}`
} as const
