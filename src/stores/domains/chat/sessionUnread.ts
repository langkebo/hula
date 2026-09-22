import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 单个会话的未读账本条目。
 *
 * - `count`：本机未读数（界面真值）。
 * - `updatedAt`：本条账本的写入时间（**本机** `Date.now()`，epoch ms）。用于判定「账本写入之后
 *   房间是否又来了新消息」：`activeTime > updatedAt` 说明服务端列表里的最后一条消息比账本还新。
 *   注意 `activeTime` 来自服务端（事件时间），与 `updatedAt` 是不同时钟：这里假设两者同量级
 *   （偏差远小于「有新消息」的间隔）。时钟大幅漂移时判定退化为保守分支（不误删未读，可能不收敛）。
 * - `settledServerCount`：服务端 `unread_count` 中已经被本机结算（读过 / 已看到）的部分。
 *
 * **不变量**：同步状态下 `服务端 unread_count === settledServerCount + count`。
 * 下面三条规则共同维护它，任何一处改动都要保持自洽：
 * 1. 本机读掉未读（`markRead`）→ `settledServerCount += readCount` 且 `count = 0`；
 * 2. 服务端快照对账（`apply` 的情况 1 / 3a）→ 用水位吸收服务端当前计数；
 * 3. 有新消息的情况 2 → 按 `resolveOpenRoomLedger`（当前打开的会话）或 `resolveCase2Ledger`
 *    （其余会话）重算两者；这是水位唯一的失效与重算点。
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
     * `291ce9c6`（`persist: true`）曾把整个 store 写进 localStorage，当时 cacheStore 的条目是
     * 裸数字；`41e6b056` 才收窄成只持久化 lastReadActiveTimeStore，但升级用户的 localStorage 里
     * 可能还残留那种结构。裸数字没有写入时间，`updatedAt` 按 0 处理：`activeTime > 0` 会被判成
     * 「账本之后有新消息」，于是退回保守的 Math.max 语义，不会误删未读。无法识别的条目直接丢弃。
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
     * `settledServerCount` 的失效与重算规则（不变量：同步状态下
     * `服务端 unread_count === settledServerCount + count`）。
     *
     * case 2（有 lastRead、activeTime 前进 = 有新消息）在「回执关 + 有账本」时的折算，也是
     * 水位唯一的失效点。返回值同时用于 UI 更新与账本写回，保证两者不会分叉。
     *
     * - **正常**：`count = max(entry.count, currentUnread - settled)`。减法项覆盖「关闭期间到达、
     *   账本还没记」的服务端增量，`entry.count` 覆盖「本机已记账、服务端快照还没跟上」的增量，
     *   取 max 避免重复计数。
     * - **失效**：`currentUnread < settled` 说明服务端那一轮计数已经被别的设备读完归零后重新累计，
     *   旧水位比服务端累计还大，做减法会把真实未读抹成 0（并写坏水位）。此时整体重算：
     *   `count = max(entry.count, currentUnread)`，水位按新的 `count` 重新起算。
     * - **无水位**（旧账本，`settled === undefined`）：退回账本计数，并用当前服务端快照起一个水位。
     */
    const resolveCase2Ledger = (
      entry: UnreadLedgerEntry,
      currentUnread: number
    ): { count: number; settledServerCount: number } => {
      const settled = entry.settledServerCount
      const count =
        settled === undefined
          ? entry.count
          : currentUnread < settled
            ? Math.max(entry.count, currentUnread)
            : Math.max(entry.count, currentUnread - settled)
      return { count, settledServerCount: Math.max(0, currentUnread - count) }
    }

    /**
     * 房间正开着时到达的消息已被本机看到：界面计数不变，但服务端累计值不能折算成未读。
     *
     * messageMutations 对当前打开的房间不增加界面未读（消息已经在视图里），关闭已读回执时
     * 服务端 unread_count 却仍会 +1；如果照常做 `服务端累计 − 水位`，已经看到的这条会被
     * 重新算成未读（角标凭空弹回）。此时账本计数才是该房间可见性的真值：直接采信 `entry.count`，
     * 并把水位对齐到服务端快照，供房间关闭后的增量折算使用。
     *
     * 采用「对账时按当前打开房间判定」而不是「每条消息把水位 +1」，是因为冷启动 SDK 会重放
     * 最近的 timeline 事件（messageMap 为空，pushMsg 的幂等检查挡不住），逐条推进水位会推过头；
     * 而对账只采信真实服务端快照，水位永远有界。
     */
    const resolveOpenRoomLedger = (entry: UnreadLedgerEntry, currentUnread: number) => ({
      count: entry.count,
      settledServerCount: Math.max(0, currentUnread - entry.count)
    })

    /**
     * 将缓存中的未读数应用到会话列表，并补齐缺失的缓存
     *
     * @param openRoomId 当前打开的会话（`globalStore.currentSessionRoomId`）。该房间的消息已经
     *   显示在视图里，服务端累计值不能折算成未读（见 resolveOpenRoomLedger）。
     * @returns 返回需要更新的会话映射 { roomId: newUnreadCount }
     */
    const apply = (uid: string | undefined, sessions: SessionItem[], openRoomId?: string): Record<string, number> => {
      const updates: Record<string, number> = {}

      if (!uid || sessions.length === 0) {
        return updates
      }
      const cache = ensureUserCache(uid)
      const lastReadCache = ensureLastReadCache(uid)
      if (!cache) {
        return updates
      }

      // 偏好必须在 apply 内读取（不得挪到 store 创建期）：会话中途切换开关要对下一次 apply 立即生效。
      const receiptsEnabled = useSettingStore().sendReadReceiptsEnabled

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
          // 关闭「发送已读回执」时服务端收不到 m.read，unread_count 不会因本机已读而减少，
          // 累计值 = 已读部分 + 真实未读。此时账本是唯一可信计数，服务端快照只通过
          // settledServerCount 水位折算「关闭期间到达」的增量（规则与不变量见 resolveCase2Ledger）。
          if (!receiptsEnabled && entry) {
            const reconciled =
              openRoomId === session.roomId
                ? resolveOpenRoomLedger(entry, currentUnread)
                : resolveCase2Ledger(entry, currentUnread)
            if (currentUnread !== reconciled.count) {
              updates[session.roomId] = reconciled.count
            }
            writeReconciledEntry(cache, session.roomId, reconciled.count, reconciled.settledServerCount)
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
        // 回执开时服务端即真源，保持既有的 Math.max(账本, 服务端) 不变；回执关时多一条跨设备
        // 收敛路径：服务端更小且账本之后没有新消息（activeTime 未前移）说明别的设备已读过。
        const serverCount = sanitizeCount(session.unreadCount)
        if (entry) {
          const noNewerMessage = activeTime <= entry.updatedAt
          const converged = !receiptsEnabled && serverCount < entry.count && noNewerMessage
          const finalCount = converged ? serverCount : Math.max(entry.count, serverCount)
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
    // 跨设备收敛由 apply 的「情况 3」显式处理（**仅回执关**，回执开时服务端即真源、行为不变）：
    // 服务端计数比账本更小、且账本之后没有新消息（activeTime 未前移）时判定为别的设备已读，
    // 采信服务端并写回账本；因此持久化账本不会像早期那样把「别的设备已读完」的房间角标永久
    // 顶住。uid 已作为一级键做账号隔离，登录态切换时的清除点是显式登出 / 账号重置
    // （SessionLogoutService）。
    persist: {
      pick: ['cacheStore', 'lastReadActiveTimeStore']
    }
  }
)
