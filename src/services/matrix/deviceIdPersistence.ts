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

export function getPersistedDeviceId(identifier: string): string | null {
  if (!identifier) return null
  if (typeof globalThis.localStorage === 'undefined') return null
  try {
    return globalThis.localStorage.getItem(`${KEY_PREFIX}${identifier}`)
  } catch {
    return null
  }
}

export function persistDeviceId(identifier: string, deviceId: string): void {
  if (!identifier || !deviceId) return
  if (typeof globalThis.localStorage === 'undefined') return
  try {
    globalThis.localStorage.setItem(`${KEY_PREFIX}${identifier}`, deviceId)
  } catch {
    // localStorage 不可用（隐私模式/配额满）时静默降级，不阻塞登录
  }
}
