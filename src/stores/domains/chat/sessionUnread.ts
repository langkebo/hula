import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 单个会话的未读账本条目。
 *
 * - `count`：本机未读数（界面真值）。
 * - `updatedAt`：本条账本的写入时间（epoch ms）。用于判定「账本写入之后房间是否又来了新消息」：
 *   `activeTime > updatedAt` 说明服务端列表里的最后一条消息比账本还新。
 * - `settledServerCount`：服务端 `unread_count` 中已经被本机结算（读过）的部分。
 *
 * 语义裁决：关闭「发送已读回执」的含义是「不让同房间成员看到我读到哪」，**不是**
 * 「每台设备各维护一套未读」。关闭回执时服务端 `unread_count` 不会因本机已读而减少
 * （不发 `m.read`），所以服务端累计值 = 已读部分 + 真实未读；`settledServerCount` 就是
 * 把已读部分减掉的水位，本机真实未读 = 服务端累计 - 已结算水位。没有它，冷启动/会话列表
 * 重建就只能拿服务端累计当未读（把已读的算回来），或把离线期间新增的消息丢掉。
 */
export interface UnreadLedgerEntry {
  count: number
  updatedAt: number
  settledServerCount?: number
}

type UnreadCache = Record<string, UnreadLedgerEntry>
type CacheStore = Record<string, UnreadCache>
type LastReadActiveTimeCache = Record<string, Record<string, number>>

/**
 * 负责管理「每个账号 -> 会话未读数」的本地缓存
 */
export const useSessionUnreadStore = defineStore(
  StoresEnum.SESSION_UNREAD,
  () => {
    // cacheStore 结构为 { [uid]: { [roomId]: { count, updatedAt, settledServerCount? } } }
    const cacheStore = ref<CacheStore>({})
    // lastReadActiveTime 结构为 { [uid]: { [roomId]: activeTime } }
    const lastReadActiveTimeStore = ref<LastReadActiveTimeCache>({})

    // 对传入的未读数做兜底处理，避免出现负数或 NaN
    const sanitizeCount = (count?: number) => {
      if (typeof count !== 'number' || Number.isNaN(count)) {
        return 0
      }
      return Math.max(0, Math.floor(count))
    }

    /**
     * 把水合进来的历史条目规整成账本条目。
     *
     * 早期版本 cacheStore 的条目是裸数字（且当时不持久化）。若 localStorage 里还残留那种
     * 结构，`updatedAt` 未知按 0 处理：`activeTime > 0` 会被判成「账本之后有新消息」，
     * 于是退回保守的 Math.max 语义，不会误删未读。无法识别的条目直接丢弃。
     */
    const normalizeEntry = (raw: unknown): UnreadLedgerEntry | undefined => {
      if (typeof raw === 'number') {
        return { count: sanitizeCount(raw), updatedAt: 0 }
      }
      if (!raw || typeof raw !== 'object') {
        return undefined
      }
      const entry = raw as Partial<UnreadLedgerEntry>
      if (typeof entry.count !== 'number') {
        return undefined
      }
      return {
        count: sanitizeCount(entry.count),
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
        settledServerCount:
          typeof entry.settledServerCount === 'number' ? sanitizeCount(entry.settledServerCount) : undefined
      }
    }

    // 根据 uid 获取对应的会话未读缓存，没有则初始化一个空对象
    const ensureUserCache = (uid?: string): UnreadCache | null => {
      if (!uid) {
        return null
      }
      if (!cacheStore.value[uid]) {
        cacheStore.value[uid] = {}
      }
      return cacheStore.value[uid]
    }

    // 根据 uid 获取对应的已读活跃时间缓存
    const ensureLastReadCache = (uid?: string): Record<string, number> | null => {
      if (!uid) return null
      if (!lastReadActiveTimeStore.value[uid]) {
        lastReadActiveTimeStore.value[uid] = {}
      }
      return lastReadActiveTimeStore.value[uid]
    }

    /** 本机产生的未读变化写入账本：刷新时间戳，保留已结算水位 */
    const writeLocalEntry = (cache: UnreadCache, roomId: string, count: number) => {
      const existing = normalizeEntry(cache[roomId])
      cache[roomId] = {
        count: sanitizeCount(count),
        updatedAt: Date.now(),
        settledServerCount: existing?.settledServerCount
      }
    }

    /**
     * 服务端快照对账后的账本写入：刷新计数与已结算水位，保留账本的写入时间。
     * 保留 `updatedAt` 是关键：它标记的是「本机最后一次记账」，对账本身不产生新消息。
     */
    const writeReconciledEntry = (cache: UnreadCache, roomId: string, count: number, settledServerCount: number) => {
      const existing = normalizeEntry(cache[roomId])
      cache[roomId] = {
        count: sanitizeCount(count),
        updatedAt: existing?.updatedAt || Date.now(),
        settledServerCount: sanitizeCount(settledServerCount)
      }
    }

    /**
     * 将缓存中的未读数应用到会话列表，并补齐缺失的缓存
     * @returns 返回需要更新的会话映射 { roomId: newUnreadCount }
     */
    const apply = (uid: string | undefined, sessions: SessionItem[]): Record<string, number> => {
      const updates: Record<string, number> = {}

      if (!uid || sessions.length === 0) {
        return updates
      }
      const cache = ensureUserCache(uid)
      const lastReadCache = ensureLastReadCache(uid)
      if (!cache) {
        return updates
      }

      sessions.forEach((session) => {
        const activeTime = session.activeTime || 0
        const lastReadTime = lastReadCache?.[session.roomId] || 0
        const currentUnread = sanitizeCount(session.unreadCount)
        const entry = normalizeEntry(cache[session.roomId])

        // 情况1：有lastReadTime记录，且activeTime <= lastReadTime（用户已读过所有消息）
        // 此时服务端返回的未读数可能是脏数据（已读状态同步延迟），应该清零
        if (lastReadTime > 0 && activeTime > 0 && activeTime <= lastReadTime) {
          // 如果服务端返回的未读数不为0，需要生成更新来修正它
          if (currentUnread !== 0) {
            updates[session.roomId] = 0
          }
          // 本机已读到最新：服务端当前计数全部计入已结算水位，本地未读为 0
          writeReconciledEntry(cache, session.roomId, 0, currentUnread)
          return
        }

        // 情况2：有lastReadTime记录，且activeTime > lastReadTime（有新消息产生）
        if (lastReadTime > 0 && activeTime > lastReadTime) {
          // 关闭「发送已读回执」时服务端收不到 m.read，unread_count 不会因本机已读而减少。
          // 此时采信服务端会把已读过的消息重新算进角标：读 3 条 → 来 1 条新消息 → 角标 4。
          // 本机账本才是可信计数；服务端快照只在账本缺失时兜底（冷启动 / 从未记过账）。
          if (!useSettingStore().sendReadReceiptsEnabled && entry) {
            // 有水位时用「服务端累计 - 已结算水位」把离线期间新增的消息一起算进来
            // （读 3 → 关闭期间来 1 → 服务端累计 4 - 水位 3 = 1）；没有水位的老账本退回账本计数。
            const localCount =
              entry.settledServerCount === undefined
                ? entry.count
                : Math.max(entry.count, currentUnread - entry.settledServerCount)
            if (currentUnread !== localCount) {
              updates[session.roomId] = localCount
            }
            writeReconciledEntry(cache, session.roomId, localCount, currentUnread - localCount)
            return
          }

          // 如果服务端返回的值与本地缓存不一致，需要生成更新
          if (currentUnread !== entry?.count) {
            updates[session.roomId] = currentUnread
          }
          // 确保本地缓存与服务端一致
          writeReconciledEntry(cache, session.roomId, currentUnread, 0)
          return
        }

        // 情况3：如果activeTime为0（可能是旧数据或初始化状态），且有lastReadTime记录，清零
        if (lastReadTime > 0 && activeTime === 0) {
          // 如果服务端返回的未读数不为0，需要生成更新来修正它
          if (currentUnread !== 0) {
            updates[session.roomId] = 0
          }
          writeReconciledEntry(cache, session.roomId, 0, currentUnread)
          return
        }

        // 情况3：没有lastReadTime记录（首次加载或从未标记已读）
        // 服务端计数与本地账本取较大值兜底，防止未读数丢失；唯一的例外是
        // 「服务端更小且账本之后没有新消息」——那是别的设备读过了，必须收敛。
        const serverCount = sanitizeCount(session.unreadCount)
        if (entry) {
          const noNewerMessage = activeTime <= entry.updatedAt
          const finalCount =
            serverCount < entry.count && noNewerMessage ? serverCount : Math.max(entry.count, serverCount)
          if (session.unreadCount !== finalCount) {
            updates[session.roomId] = finalCount
          }
          writeReconciledEntry(cache, session.roomId, finalCount, serverCount - finalCount)
        } else {
          const finalCount = serverCount
          if (session.unreadCount !== finalCount) {
            updates[session.roomId] = finalCount
          }
          writeReconciledEntry(cache, session.roomId, finalCount, 0)
        }
      })

      return updates
    }

    /** 更新单个会话的未读数，并同步写入缓存映射 */
    const set = (uid: string | undefined, roomId: string, count: number) => {
      const cache = ensureUserCache(uid)
      if (!cache) {
        return
      }

      const normalized = sanitizeCount(count)
      if (normalizeEntry(cache[roomId])?.count === normalized) {
        return
      }
      writeLocalEntry(cache, roomId, normalized)
    }

    /**
     * 记录本机「已读到服务端当前计数」的水位：把读掉的条数计入 `settledServerCount`。
     *
     * 关闭已读回执时服务端 unread_count 不会因本机已读而减少，只有这个水位才能让 apply
     * 把服务端累计值折算成本机真实未读（含离线期间新增的消息）。
     */
    const markRead = (uid: string | undefined, roomId: string, readCount: number) => {
      const cache = ensureUserCache(uid)
      if (!cache) {
        return
      }
      const existing = normalizeEntry(cache[roomId])
      const settledServerCount = sanitizeCount((existing?.settledServerCount ?? 0) + sanitizeCount(readCount))
      cache[roomId] = {
        count: 0,
        updatedAt: Date.now(),
        settledServerCount
      }
    }

    /** 记录某个会话最后一次已读时的活跃时间 */
    const setLastRead = (uid: string | undefined, roomId: string, activeTime: number) => {
      const cache = ensureLastReadCache(uid)
      if (!cache) return
      if (!activeTime) return
      cache[roomId] = Math.max(activeTime, cache[roomId] || 0)
    }

    /** 删除某个会话的未读数缓存，在会话被移除或账号切换时调用 */
    const remove = (uid: string | undefined, roomId: string) => {
      const cache = ensureUserCache(uid)
      const lastReadCache = ensureLastReadCache(uid)
      if (!cache || !(roomId in cache)) {
        return
      }
      delete cache[roomId]
      if (lastReadCache && roomId in lastReadCache) {
        delete lastReadCache[roomId]
      }
      if (Object.keys(cache).length === 0 && uid) {
        delete cacheStore.value[uid]
        delete lastReadActiveTimeStore.value[uid]
      }
    }

    return {
      cacheStore,
      lastReadActiveTimeStore,
      apply,
      set,
      markRead,
      setLastRead,
      remove
    }
  },
  {
    // 未读账本整体持久化（本机计数 + 已读水位 + 结算水位）：
    //
    // - `lastReadActiveTimeStore`：apply 的「情况 1」（activeTime <= lastReadTime 时清零并纠正
    //   服务端脏未读数）依赖它，丢了它冷启动就退回兜底逻辑，把已读房间的角标写回来。
    // - `cacheStore`：关闭「发送已读回执」时账本是唯一可信计数。不持久化的话，「读 3 条 →
    //   关闭期间来 1 条 → 重启」会在冷启动时退回服务端累计值，把已读的 3 条重新算进角标。
    //
    // 跨设备收敛由 apply 的「情况 3」显式处理：服务端计数比账本更小、且账本之后没有新消息
    // （activeTime 未前移）时判定为别的设备已读，采信服务端并写回账本；因此持久化账本不会像
    // 早期那样把「别的设备已读完」的房间角标永久顶住。uid 已作为一级键做账号隔离，
    // 登录态切换时的清除点是显式登出 / 账号重置（SessionLogoutService）。
    persist: {
      pick: ['cacheStore', 'lastReadActiveTimeStore']
    }
  }
)
