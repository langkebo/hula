import { PREFIX_VENDOR_V1 } from './prefixes'

export const BURN = {
  STATS: PREFIX_VENDOR_V1 + '/user/burn/stats',
  ROOM_BURN: (roomId: string) => `${PREFIX_VENDOR_V1}/rooms/${encodeURIComponent(roomId)}/burn`
} as const
