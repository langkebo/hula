/**
 * Matrix 用户标识统一工具
 *
 * 全工程关于 `userId / account / displayname` 的口径：
 *   - `uid` / `userId` —— 完整 MXID，例如 `@hulatest:matrix.test`
 *   - `account`       —— MXID 的 localpart，例如 `hulatest`
 *   - `name`          —— `/profile` 返回的 displayname，例如 `test6`
 *
 * 所有从 Matrix SDK 拿到 MXID 的地方都应使用此工具的 helper，
 * 避免出现 `'@hulatest:matrix.test' / 'hulatest' / 'test6'` 多套混用。
 */

/**
 * 从 MXID 中提取 localpart。
 *
 * - `@hulatest:matrix.test` → `hulatest`
 * - `hulatest`              → `hulatest`
 * - 空串 / undefined        → `''`
 */
export function toLocalpart(mxid?: string | null): string {
  if (!mxid) return ''
  const trimmed = mxid.trim()
  if (!trimmed) return ''
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  const colonIdx = withoutAt.indexOf(':')
  return colonIdx === -1 ? withoutAt : withoutAt.slice(0, colonIdx)
}

/**
 * 从 MXID 中提取 server name。
 *
 * - `@hulatest:matrix.test` → `matrix.test`
 * - `hulatest`              → `''`
 */
function toServerName(mxid?: string | null): string {
  if (!mxid) return ''
  const colonIdx = mxid.indexOf(':')
  return colonIdx === -1 ? '' : mxid.slice(colonIdx + 1)
}

/**
 * 公开导出：从任意 MXID（用户或房间 ID `!:opaque:server`）中提取 server name。
 * 联邦判定时复用，避免重复解析逻辑。
 */
export function extractServerName(mxid?: string | null): string {
  return toServerName(mxid)
}

/**
 * 把「MXID 或纯 server name」统一归一化为可比较的 server name。
 *
 * - `@user:matrix.test` → `matrix.test`
 * - `!room:matrix.test` → `matrix.test`
 * - `matrix.test`       → `matrix.test`（已是 server name，直接使用）
 * - 空值                → `''`
 *
 * 统一小写：homeserver 名是 DNS 风格，大小写不应造成「同一服务器被判为远端」。
 */
function normalizeHomeserver(value?: string | null): string {
  const trimmed = (value ?? '').trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed.startsWith('@') || trimmed.startsWith('!')) {
    return toServerName(trimmed)
  }
  return trimmed
}

/**
 * 联邦判定（单一事实源）：两个标识是否属于同一 homeserver。
 *
 * 入参可以是 MXID，也可以直接是 server name，二者可混用。
 * 任一方无法解析出 server name 时返回 `false`（不轻易断言「本地」）。
 */
export function sameHomeserver(a?: string | null, b?: string | null): boolean {
  const left = normalizeHomeserver(a)
  const right = normalizeHomeserver(b)
  if (!left || !right) return false
  return left === right
}

/** 联邦对端解析结果 */
export interface FederationPeer {
  /** 对端 server name；无法解析时为空串 */
  server: string
  /** 是否来自远端 homeserver */
  isRemote: boolean
}

/**
 * 解析联邦对端：给出对端 server 与「是否远端」。
 *
 * 无法判定时（对端 MXID 解析不出 server，或本机 homeserver 尚未就绪）
 * 一律返回 `isRemote: false`，即**按本地处理**——避免本机信息未就绪的瞬间
 * 把所有联系人误标为「联邦用户」。
 *
 * @param mxid 待判定的 MXID（或纯 server name）
 * @param localServer 本机 homeserver（可传 MXID 或 server name）
 */
export function resolveFederationPeer(mxid?: string | null, localServer?: string | null): FederationPeer {
  const server = normalizeHomeserver(mxid)
  const local = normalizeHomeserver(localServer)

  if (!server || !local) return { server, isRemote: false }

  return { server, isRemote: server !== local }
}

/**
 * 校验是否为合法 MXID。
 */
function isMatrixUserId(value?: string | null): boolean {
  if (!value) return false
  return /^@[^:]+:[^:]+$/.test(value.trim())
}

/**
 * 将 localpart 或 MXID 规范化为完整 MXID。
 *
 * - `ljf1` + `@me:matrix.test` => `@ljf1:matrix.test`
 * - `@ljf1:matrix.test`        => `@ljf1:matrix.test`
 */
export function normalizeMatrixUserId(value?: string | null, currentUserId?: string | null): string {
  const trimmed = value?.trim() || ''
  if (!trimmed) return ''
  if (isMatrixUserId(trimmed)) {
    return trimmed
  }

  const serverName = toServerName(currentUserId)
  if (!serverName) {
    return trimmed
  }

  const localpart = toLocalpart(trimmed)
  return localpart ? `@${localpart}:${serverName}` : trimmed
}

/**
 * DM 会话"同人判定"的统一归一化键（单一事实源）。
 *
 * 历史教训：会话去重曾在服务层（getSessionList）、store 层（addSession）、
 * UI 层（useSessionListState dmSeen）各自实现，且 key 归一化口径不一致
 * （有的比较原始值、有的比较 localpart），导致同一联系人 `test1` 与
 * `@test1:matrix.test` 被判为两人、消息列表反复出现重复会话。
 *
 * 所有层判断"两条 SINGLE 会话是否同一联系人"必须经过本函数：
 * detailId 优先、account 其次，统一取 localpart 归一化后比较。
 *
 * @returns 归一化 localpart；两者皆缺失返回 ''（调用方应回退其他兜底键，如 roomId）
 */
export function resolveDmIdentityKey(identity: { detailId?: string | null; account?: string | null }): string {
  return toLocalpart(identity.detailId) || toLocalpart(identity.account)
}
