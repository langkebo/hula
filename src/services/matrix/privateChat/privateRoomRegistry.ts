import { ref } from 'vue'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PrivateRoomRegistry')

/**
 * 私密房间登记表（方案 P0-0-a）。
 *
 * 为什么不用 `session.hide`：`hide` 是**会话展示态**，点击私密会话还会被改回 false，
 * 撑不起「两类房间」的语义；而且它只存在本地 session 里，换设备即丢。
 *
 * 存储策略：
 * - **权威副本**：账号级 account data `com.hula.private_rooms`（跨设备同步）；
 * - **本地缓存**：localStorage（按 userId 隔离），用于**同步判定**——
 *   `isPrivateRoom()` 会在 computed 里被高频调用，不能等异步 account data 拉取，
 *   否则私密房间会先闪进普通列表再消失（信息泄漏）。
 *
 * ⚠️ 隐私边界：account data 内容对服务端可见，即服务端能知道「哪些房间被标记为私密」。
 * 这是 Matrix 模型下的固有限制，已写入方案 §9「不做承诺」。
 */

/** account data 事件类型。 */
const PRIVATE_ROOMS_ACCOUNT_DATA = 'com.hula.private_rooms'

/** account data 结构。 */
interface PrivateRoomsContent {
  version: 1
  roomIds: string[]
}

/** localStorage key 前缀（按 userId 隔离，避免换账号串味）。 */
const STORAGE_PREFIX = 'tjg:privateRooms:'

let cachedUserId: string | null = null
let cachedRoomIds = new Set<string>()
let loaded = false
/**
 * 响应式版本号：Set 本身不是响应式的，而 `isPrivateRoom()` 会在 computed 里被调用。
 * 每次登记表变更后递增，令依赖它的 computed 失效重算（否则迁移/标记后列表不刷新）。
 */
const registryVersion = ref(0)

function bumpVersion(): void {
  registryVersion.value += 1
}

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? 'anonymous'}`
}

function readCache(userId: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { roomIds?: unknown }
    if (!Array.isArray(parsed.roomIds)) return new Set()
    return new Set(parsed.roomIds.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function writeCache(userId: string | null, roomIds: Set<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ roomIds: [...roomIds] }))
  } catch (err) {
    logger.warn('写入私密房间本地缓存失败（不影响内存态）:', err)
  }
}

function currentUserId(): string | null {
  try {
    return matrixClientService.getUserId() ?? null
  } catch {
    return null
  }
}

function ensureLoaded(): void {
  const userId = currentUserId()
  if (loaded && cachedUserId === userId) return
  cachedUserId = userId
  cachedRoomIds = readCache(userId)
  loaded = true
}

/** 同步判定某房间是否为私密房间（供 computed / 模板使用）。 */
export function isPrivateRoom(roomId: string | undefined | null): boolean {
  if (!roomId) return false
  // 读取版本号建立响应式依赖，登记表变更后 computed 才会重算
  registryVersion.value
  ensureLoaded()
  return cachedRoomIds.has(roomId)
}

async function persist(userId: string | null, roomIds: Set<string>): Promise<void> {
  const client = matrixClientService.getClient()
  if (!client) {
    throw new Error('客户端未就绪，无法保存私密房间标记')
  }
  const content: Record<string, unknown> = { version: 1, roomIds: [...roomIds] }
  await client.setAccountData(PRIVATE_ROOMS_ACCOUNT_DATA, content)
  writeCache(userId, roomIds)
}

/**
 * 串行化登记表写入：mark/unmark 都是「读快照 → await 网络 → 写回」，
 * 并发执行时后完成的调用会用陈旧快照覆盖先完成的结果（丢失一次标记）。
 * 用一条 Promise 链把变更排队，保证每次读到的都是上一次写入后的状态。
 */
let mutationChain: Promise<void> = Promise.resolve()

function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(task, task)
  mutationChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/** 标记房间为私密；已标记则幂等返回。 */
export async function markRoomPrivate(roomId: string): Promise<void> {
  return enqueueMutation(async () => {
    ensureLoaded()
    const userId = cachedUserId
    if (cachedRoomIds.has(roomId)) return
    const next = new Set(cachedRoomIds).add(roomId)
    await persist(userId, next)
    // await 期间可能已切换账号/重载登记表：只在账号未变时写回内存态，
    // 否则会用旧账号快照覆盖新账号的缓存。
    if (cachedUserId !== userId) {
      logger.warn(`账号已切换，丢弃过期的私密标记结果: ${roomId}`)
      return
    }
    cachedRoomIds = next
    bumpVersion()
    logger.info(`房间已标记为私密: ${roomId}`)
  })
}

/** 取消私密标记；未标记则幂等返回。 */
export async function unmarkRoomPrivate(roomId: string): Promise<void> {
  return enqueueMutation(async () => {
    ensureLoaded()
    const userId = cachedUserId
    if (!cachedRoomIds.has(roomId)) return
    const next = new Set(cachedRoomIds)
    next.delete(roomId)
    await persist(userId, next)
    if (cachedUserId !== userId) {
      logger.warn(`账号已切换，丢弃过期的私密标记结果: ${roomId}`)
      return
    }
    cachedRoomIds = next
    bumpVersion()
    logger.info(`房间已取消私密标记: ${roomId}`)
  })
}

/**
 * 从服务端拉取登记表并刷新本地缓存（登录后 / 收到 account data 变更时调用）。
 *
 * 服务端内容为空时**不清空本地**：可能是首次同步尚未完成，清空会让私密房漏进普通列表。
 */
export async function loadPrivateRoomRegistry(): Promise<void> {
  const userId = currentUserId()
  const client = matrixClientService.getClient()
  if (!client) return
  try {
    const event = client.getAccountData(PRIVATE_ROOMS_ACCOUNT_DATA)
    const raw = event?.getContent() as Partial<PrivateRoomsContent> | undefined
    if (!raw || !Array.isArray(raw.roomIds)) {
      cachedUserId = userId
      cachedRoomIds = readCache(userId)
      loaded = true
      return
    }
    const roomIds = new Set(raw.roomIds.filter((id): id is string => typeof id === 'string'))
    cachedUserId = userId
    cachedRoomIds = roomIds
    loaded = true
    writeCache(userId, roomIds)
    bumpVersion()
    logger.info(`私密房间登记表已加载: ${roomIds.size} 个`)
  } catch (err) {
    logger.warn('加载私密房间登记表失败，沿用本地缓存:', err)
  }
}

let readyPromise: Promise<void> | null = null

/**
 * 确保登记表已按**当前账号**加载完毕（幂等，路由守卫冷启动深链时使用）。
 *
 * 冷启动时 `localStorage` 里的缓存可能还是上一个账号或空的，若此时直接判定私密房，
 * 会把私密房当普通房放行。因此这里等客户端就绪后再拉一次 account data。
 * 失败时**清空 promise**，让后续导航可以重试（一次性失败不该永久失去门禁）。
 */
export function ensurePrivateRoomRegistryReady(): Promise<void> {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    let settled = false
    try {
      if (!matrixClientService.getClient()) {
        await matrixClientService.waitForClientReady({ timeoutMs: 8000 })
      }
      await loadPrivateRoomRegistry()
      settled = matrixClientService.getUserId() !== null
    } catch (err) {
      logger.warn('确保私密房间登记表就绪失败，沿用本地缓存:', err)
    }
    if (!settled) {
      readyPromise = null
    }
  })()
  return readyPromise
}

/**
 * 一次性迁移：把历史上被 `session.hide` 标记的会话写入登记表。
 *
 * @param hiddenRoomIds 当前 `hide === true` 的房间 ID
 * @returns 实际迁移的数量
 */
export async function migrateFromHiddenSessions(hiddenRoomIds: string[]): Promise<number> {
  ensureLoaded()
  const pending = hiddenRoomIds.filter((id) => !cachedRoomIds.has(id))
  if (pending.length === 0) return 0
  const next = new Set(cachedRoomIds)
  for (const id of pending) next.add(id)
  await persist(cachedUserId, next)
  cachedRoomIds = next
  bumpVersion()
  logger.info(`已迁移 ${pending.length} 个隐藏会话为私密房间`)
  return pending.length
}
