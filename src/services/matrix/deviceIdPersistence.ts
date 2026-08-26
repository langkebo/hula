/**
 * deviceId 本地持久化（localStorage），用于密码/SSO 登录复用上次登录的设备，
 * 避免每次登录在服务器端累积新设备（设备列表过多）。
 *
 * key 规则：`tjg.persistedDeviceId:<identifier>`，identifier 为登录输入原样
 * （密码登录用 username，SSO 登录用完整 userId）。
 *
 * 为什么用 localStorage 而非后端：密码/SSO 登录前尚无 access token，无法走
 * whoami 预解析（whoami 仅对 token 登录有效），只能依赖本地持久化的 deviceId。
 */
const KEY_PREFIX = 'tjg.persistedDeviceId:'

/**
 * 读取本地持久化的 deviceId；无存储/未设置时返回 null。
 * @param identifier 登录标识（密码登录为 username，SSO 登录为完整 userId）
 * @returns 持久化的 deviceId，或 null
 */
export function getPersistedDeviceId(identifier: string): string | null {
  if (!identifier) return null
  if (typeof globalThis.localStorage === 'undefined') return null
  try {
    return globalThis.localStorage.getItem(`${KEY_PREFIX}${identifier}`)
  } catch {
    return null
  }
}

/**
 * 将 deviceId 持久化到 localStorage，供下次登录复用，避免重复创建设备。
 * @param identifier 登录标识（密码登录为 username，SSO 登录为完整 userId）
 * @param deviceId 待持久化的设备 ID
 */
export function persistDeviceId(identifier: string, deviceId: string): void {
  if (!identifier || !deviceId) return
  if (typeof globalThis.localStorage === 'undefined') return
  try {
    globalThis.localStorage.setItem(`${KEY_PREFIX}${identifier}`, deviceId)
  } catch {
    // localStorage 不可用（隐私模式/配额满）时静默降级，不阻塞登录
  }
}

/**
 * 生成一个新的设备 ID（16 位大写十六进制）。
 *
 * 用于 token 登录 / 会话恢复时，若 whoami 端点也未返回 device_id 的兜底：
 * 确保 createClient 时 deviceId 有值，否则 SDK 的 getDeviceId() 恒为 null，
 * ensureCrypto 会因「缺少 userId 或 deviceId」跳过 Rust Crypto 初始化（E2EE 失效）。
 *
 * 与 qrLoginHelpers.generateDeviceId 同源（crypto.getRandomValues 8 字节），
 * 独立在此实现以保持 deviceIdPersistence 零依赖，避免引入 QR 登录模块的重依赖链。
 */
export function generateDeviceId(): string {
  const random = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}
