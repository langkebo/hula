/**
 * Crypto 路径组（L3 路径常量）
 *
 * FT-120: 仅保留被 L2 服务实际引用的常量。大部分 crypto 操作走 SDK 的
 * cryptoSDKAdapter 管理器（内部封装 HTTP），前端不直接拼接 URL；
 * 以下常量用于 endpointCapabilityService.check() 能力探测或直接 HTTP 调用。
 *
 * 已移除的死常量（FT-120）：
 *   KEYS_UPLOAD / KEYS_QUERY / KEYS_CLAIM / KEYS_CHANGES — MatrixCryptoService 走 manager
 *   DEVICE_SIGNING_UPLOAD / SIGNATURES_UPLOAD / SEND_TO_DEVICE — 走 manager
 *   ROOM_KEYS_VERSION / ROOM_KEYS_VERSION_BY_ID / ROOM_KEYS_KEYS / ROOM_KEYS_KEYS_BY_ROOM /
 *   ROOM_KEYS_KEYS_BY_SESSION — 走 KeyBackupManager
 *   ROOM_KEYS_RECOVERY_PROGRESS / ROOM_KEYS_VERIFY / ROOM_KEYS_BATCH_RECOVER /
 *   ROOM_KEYS_RECOVER_ROOM / ROOM_KEYS_RECOVER_SESSION / ROOM_KEYS_EXPORT / ROOM_KEYS_IMPORT — 走 manager
 *   VERIFY_ACCEPT / VERIFY_KEY_AGREEMENT / VERIFY_MAC / VERIFY_DONE / VERIFY_CANCEL /
 *   KEY_ROTATION_* — 未实现
 *   VERIFY_START / QR_CODE_SHOW / QR_CODE_SCAN — 后端 `keys/device_signing/verify_*`
 *   与 `keys/qr_code/*` 已整段删除（2026-09-25 E2EE 重构），SDK 侧 KeyVerificationManager
 *   与对应能力探测同批删除，前端不得再保留「点了必然失败」的入口
 */
export const CRYPTO = {
  /** POST — 密钥恢复端点（MatrixCryptoService.recoverKey 能力探测）。 */
  ROOM_KEYS_RECOVER: '/room_keys/recover',
  /** GET — 房间密钥请求列表（MatrixDeviceService.getRoomKeyRequests）。 */
  ROOM_KEYS_REQUEST: '/room_keys/request'
} as const
