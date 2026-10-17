import { PREFIX_VENDOR_V1 } from './prefixes'

/**
 * Room 级路径常量。
 *
 * 其余端点均已收敛到 SDK manager（Timeline / State / Membership / Receipt /
 * Pins / Aliases / Lifecycle / Tags / Typing / Room 等），不再保留自研路径常量。
 * 仅 `REPORT_SCANNER_INFO` 为后端 vendor 私有扩展，SDK 无对应能力。
 */
export const ROOM = {
  REPORT_SCANNER_INFO: (roomId: string, eventId: string) =>
    `${PREFIX_VENDOR_V1}/rooms/${encodeURIComponent(roomId)}/report/${encodeURIComponent(eventId)}/scanner_info`
} as const
