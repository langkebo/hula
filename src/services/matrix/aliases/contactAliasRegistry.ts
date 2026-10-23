import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('ContactAliasRegistry')

/**
 * 每联系人别名（F-6）。
 *
 * ## 这是什么
 *
 * 「对方看到的**我**」—— 与「我给对方起的备注名」（`FRIENDS.NOTE`）**方向相反**：
 * - 备注名：只有我自己能看到，存在服务端的 friend note 里；
 * - 别名：**对方**看到我的显示名/头像变成这个值，靠房间级 `m.room.member` 生效。
 *
 * UI 必须把两者分开呈现，否则用户会以为改了备注对方就能看到（或反过来）。
 *
 * ## 为什么存 account data 而不是房间状态
 *
 * 别名是「我对某人的设定」，与房间生命周期解耦：DM 房间被重建后本应继续生效。
 * 放房间状态里会在重建时丢失。房间级 `m.room.member` 只是**投递手段**，
 * 权威副本在这里。
 *
 * ## 能力边界（不可越界承诺）
 *
 * 兑现：对方看不到我的昵称/头像。
 * 不兑现：对方仍能看到我的 MXID（协议决定）、服务端仍可见、presence 仍按账号广播。
 */
const CONTACT_ALIAS_ACCOUNT_DATA = 'com.hula.contact_alias'

/** 别名显示名长度上限（与全局 profile 的常见限制对齐，避免超长破坏气泡布局） */
export const CONTACT_ALIAS_MAX_NAME_LENGTH = 64

export interface ContactAlias {
  displayName: string
  /** 房间级头像（mxc://）。留空表示沿用全局头像 */
  avatarMxc?: string
  updatedAt: number
}

export interface ContactAliasBook {
  version: 1
  aliases: Record<string, ContactAlias>
}

let cached: ContactAliasBook = { version: 1, aliases: {} }
let loaded = false

/** 响应式版本号：别名变更后驱动 computed 重算（沿用 privateRoomRegistry 的做法） */
const aliasVersion = ref(0)

/** 响应式版本号本体：UI 在 computed 里读它即可建立依赖 */
export const contactAliasVersion = aliasVersion

/**
 * 规范化显示名。
 *
 * @returns 合法则返回规范化结果，非法（空 / 全空白 / 超长）返回 null
 */
export function sanitizeAliasDisplayName(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  if ([...collapsed].length > CONTACT_ALIAS_MAX_NAME_LENGTH) return null
  return collapsed
}

/**
 * 解析 account data（容错：垃圾数据一律当作空表，不能让坏数据锁死功能）。
 */
export function parseAliasBook(content: unknown): ContactAliasBook {
  const book: ContactAliasBook = { version: 1, aliases: {} }
  if (!content || typeof content !== 'object') return book

  const aliases = (content as { aliases?: unknown }).aliases
  if (!aliases || typeof aliases !== 'object') return book

  for (const [userId, value] of Object.entries(aliases as Record<string, unknown>)) {
    if (!userId.startsWith('@') || !value || typeof value !== 'object') continue
    const entry = value as { displayName?: unknown; avatarMxc?: unknown; updatedAt?: unknown }
    const displayName = typeof entry.displayName === 'string' ? sanitizeAliasDisplayName(entry.displayName) : null
    if (!displayName) continue

    book.aliases[userId] = {
      displayName,
      ...(typeof entry.avatarMxc === 'string' && entry.avatarMxc.startsWith('mxc://')
        ? { avatarMxc: entry.avatarMxc }
        : {}),
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0
    }
  }
  return book
}

function client() {
  return matrixClientService.getClient()
}

/**
 * 从服务端账号数据加载（幂等：已加载则跳过）。
 *
 * 读不到（未登录 / 无此事件）时保持空表 —— 别名缺失只影响展示，不应阻断任何流程。
 */
export async function loadContactAliases(force = false): Promise<void> {
  if (loaded && !force) return
  const matrixClient = client()
  if (!matrixClient) {
    loaded = true
    return
  }

  try {
    const event = matrixClient.getAccountData(CONTACT_ALIAS_ACCOUNT_DATA as never)
    cached = parseAliasBook(event?.getContent())
  } catch (err) {
    logger.warn('读取联系人别名失败（按空表处理）:', err)
    cached = { version: 1, aliases: {} }
  }
  loaded = true
  aliasVersion.value += 1
}

/** 同步读取（调用方需先 `loadContactAliases()`） */
export function getContactAlias(userId: string): ContactAlias | null {
  return cached.aliases[userId] ?? null
}

/** 是否已为该联系人设了别名（用于列表/详情页标记与 UI 区分） */
export function hasContactAlias(userId: string): boolean {
  return Boolean(cached.aliases[userId])
}

/**
 * 写入别名（仅落 account data）。
 *
 * ⚠️ 这里**不**碰房间状态：投递由 `applyContactAlias` 负责。
 * 二者分开是为了让「设置别名但 DM 还不存在」成为合法中间态。
 */
export async function saveContactAlias(
  userId: string,
  input: { displayName: string; avatarMxc?: string }
): Promise<ContactAlias> {
  const displayName = sanitizeAliasDisplayName(input.displayName)
  if (!displayName) {
    throw new Error('CONTACT_ALIAS_INVALID_DISPLAY_NAME')
  }

  const matrixClient = client()
  if (!matrixClient) {
    throw new Error('CONTACT_ALIAS_NOT_LOGGED_IN')
  }

  await loadContactAliases()
  const next: ContactAliasBook = {
    version: 1,
    aliases: {
      ...cached.aliases,
      [userId]: {
        displayName,
        ...(input.avatarMxc?.startsWith('mxc://') ? { avatarMxc: input.avatarMxc } : {}),
        updatedAt: Date.now()
      }
    }
  }

  await matrixClient.setAccountData(CONTACT_ALIAS_ACCOUNT_DATA, next as never)
  cached = next
  aliasVersion.value += 1
  return next.aliases[userId]
}

/**
 * 删除别名（只删 account data；房间状态必须由调用方另行清除）。
 *
 * 刻意**不**在这里顺手清房间状态：清房间是网络写操作，
 * 把它藏进「删本地记录」里会让失败变得不可见 —— 用户以为清了，对方还看着旧名字。
 */
export async function removeContactAlias(userId: string): Promise<void> {
  const matrixClient = client()
  if (!matrixClient) throw new Error('CONTACT_ALIAS_NOT_LOGGED_IN')

  await loadContactAliases()
  const { [userId]: _removed, ...rest } = cached.aliases
  const next: ContactAliasBook = { version: 1, aliases: rest }

  await matrixClient.setAccountData(CONTACT_ALIAS_ACCOUNT_DATA, next as never)
  cached = next
  aliasVersion.value += 1
}

/** 登出时清内存态（避免换账号后残留别人的别名） */
export function clearContactAliasCache(): void {
  cached = { version: 1, aliases: {} }
  loaded = false
  aliasVersion.value += 1
}

/** 仅供测试 */
export function __setAliasBookForTest(book: ContactAliasBook): void {
  cached = book
  loaded = true
  aliasVersion.value += 1
}
