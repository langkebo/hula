/**
 * 一次性邀请的链接解析与展示辅助（纯函数，可单测）。
 *
 * ## 为什么需要解析而不是直接用后端返回的 `deep_link`
 *
 * 后端返回的 `deep_link` 形如
 * `https://<server>/_matrix/vendor/v1/invites/claim?token=<token>`。
 * 那个地址是 **POST-only** 接口，直接用浏览器打开会 404/405 —— 它是"可分享的凭据载体"，
 * 不是可点击的落地页。所以 UI 提供的是「复制链接 → 对方在 App 内粘贴」，
 * 由 App 解析出 token 再 POST。
 *
 * 谎称"点开即加入"会立刻被现实打脸，这里不做这种承诺。
 */

/** 从粘贴内容中取出 token；支持纯 token 或带 `token=` 的链接 */
export function extractInviteToken(input: string): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null

  // 纯 token：base64url（32B → 43 字符，无填充）
  if (/^[A-Za-z0-9_-]{16,64}$/.test(raw)) return raw

  // 链接形态：优先标准 query 解析，退化到正则（有些分享来源会丢掉 scheme）
  const queryStart = raw.indexOf('?')
  if (queryStart >= 0) {
    const params = new URLSearchParams(raw.slice(queryStart + 1))
    const fromQuery = params.get('token')
    if (fromQuery && /^[A-Za-z0-9_-]{16,64}$/.test(fromQuery)) return fromQuery
  }

  const match = raw.match(/[?&]token=([A-Za-z0-9_-]{16,64})/)
  return match ? match[1] : null
}

/** 是否已过期（`expiresAt` 为毫秒时间戳） */
export function isInviteExpired(expiresAt: number, now: number = Date.now()): boolean {
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

/**
 * 剩余有效期（毫秒，最小 0）。
 *
 * 不用它做倒计时刷新：调用方按需轮询/定时即可，纯函数不持有定时器。
 */
export function remainingInviteMs(expiresAt: number, now: number = Date.now()): number {
  if (!Number.isFinite(expiresAt)) return 0
  return Math.max(0, expiresAt - now)
}

/** 把剩余毫秒格式化成「x 小时 y 分」/「y 分」粒度（不足 1 分按 1 分显示） */
export function formatInviteRemaining(remainingMs: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}
