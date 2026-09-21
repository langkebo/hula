import { normalizeUserId } from './invitePolicy'

/**
 * 邀请人是否是我的联系人——三态而不是布尔。
 *
 * ## 为什么必须是三态
 *
 * `MatrixFriendService.isFriend()` 在查询失败时 catch 并**返回 `false`**，
 * 与"确认不是好友"完全不可区分。若把 `false` 直接当陌生人处理，
 * 后端抖动或离线一次，开启「仅允许联系人私聊」的用户会在那个窗口里
 * 把所有好友的邀请都拒掉。
 *
 * 因此：
 * - `contact`  = 已确认是联系人
 * - `stranger` = 已确认不是联系人
 * - `unknown`  = 无法确认（查询失败、id 缺失）
 *
 * 只有 `stranger` 参与"拒绝非联系人邀请"的判定；`unknown` 一律放行（fail-open），
 * 宁可漏放一个陌生人的邀请，也不误拒好友的邀请。
 */
export type ContactState = 'contact' | 'stranger' | 'unknown'

export interface ContactStateResolverDeps {
  /** 返回 true/false 表示确认结果；抛错表示无法确认。 */
  isFriend: (userId: string) => Promise<boolean>
  /** 缓存有效期，默认 5 分钟。 */
  ttlMs?: number
  now?: () => number
}

export interface ContactStateResolver {
  resolve: (userId: unknown) => Promise<ContactState>
  /** 用已知好友列表预热缓存（启动时同步一次，省掉逐个查询）。 */
  seed: (userIds: readonly string[]) => void
  clear: () => void
}

const DEFAULT_TTL_MS = 5 * 60 * 1000

export function createContactStateResolver(deps: ContactStateResolverDeps): ContactStateResolver {
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS
  const now = deps.now ?? (() => Date.now())
  const cache = new Map<string, { state: ContactState; at: number }>()
  const inFlight = new Map<string, Promise<ContactState>>()

  function readCache(userId: string): ContactState | undefined {
    const hit = cache.get(userId)
    if (!hit) {
      return undefined
    }
    if (now() - hit.at > ttlMs) {
      cache.delete(userId)
      return undefined
    }
    return hit.state
  }

  async function resolve(userId: unknown): Promise<ContactState> {
    const id = normalizeUserId(userId)
    if (!id) {
      return 'unknown'
    }

    const cached = readCache(id)
    if (cached) {
      return cached
    }

    // 同一用户的并发查询合并成一次（一次邀请会触发多条 member 事件）
    const pending = inFlight.get(id)
    if (pending) {
      return pending
    }

    const task = (async (): Promise<ContactState> => {
      try {
        const result = await deps.isFriend(id)
        const state: ContactState = result === true ? 'contact' : 'stranger'
        cache.set(id, { state, at: now() })
        return state
      } catch {
        // 不写缓存：下次仍有确认机会
        return 'unknown'
      } finally {
        inFlight.delete(id)
      }
    })()

    inFlight.set(id, task)
    return task
  }

  function seed(userIds: readonly string[]): void {
    const at = now()
    for (const raw of userIds) {
      const id = normalizeUserId(raw)
      if (id && !cache.has(id)) {
        cache.set(id, { state: 'contact', at })
      }
    }
  }

  function clear(): void {
    cache.clear()
    inFlight.clear()
  }

  return { resolve, seed, clear }
}
