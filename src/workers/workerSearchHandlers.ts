/**
 * Worker 搜索索引引擎
 *
 * 负责在 Worker 线程中维护本地搜索索引（倒排索引 + IndexedDB 持久化），
 * 支持房间名搜索和消息全文搜索。
 *
 * 从 matrixSdk.worker.ts 拆分，保持原有逻辑不变。
 */

import type {
  SearchEventDoc,
  SearchIndexStats,
  SearchMessageHit,
  SearchQueryPayload,
  SearchQueryResult,
  SearchRoomDoc,
  SearchRoomHit
} from './matrixWorkerTypes'
import {
  clearAllSearchData,
  deleteEventFromDB,
  deleteRoomFromDB,
  loadEventsFromDB,
  loadRoomsFromDB,
  saveEventsToDB,
  saveRoomsToDB,
  setSearchIndexKey
} from './searchIndexDb'
import { createWorkerLogger } from './workerLogger'

/** base64 → 字节（worker 环境有 atob） */
function fromBase64(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const logger = createWorkerLogger('MatrixWorker')

// --- 内存与性能优化配置 ---
const MAX_INDEXED_EVENTS_PER_ROOM = 500
const MAX_INDEXED_EVENTS_GLOBAL = 20000
const MAX_SEARCH_BODY_LENGTH = 500

type IndexedSearchEventDoc = SearchEventDoc & {
  normalizedBody: string
}

const searchRoomDocs = new Map<string, SearchRoomDoc>()
const searchRoomNames = new Map<string, string>()
const searchEventDocs = new Map<string, IndexedSearchEventDoc>()
const searchEventTokens = new Map<string, string[]>()
const searchRoomEventIds = new Map<string, string[]>()
const searchInvertedIndex = new Map<string, Set<string>>()

let isSearchIndexLoaded = false

// --- 搜索工具函数 ---

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function trimSearchBody(value: string): string {
  const normalized = value.trim()
  return normalized.length > MAX_SEARCH_BODY_LENGTH ? normalized.slice(0, MAX_SEARCH_BODY_LENGTH) : normalized
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value)
  if (!normalized) return []
  const tokens = normalized.match(/[a-z0-9_]+/g) || []
  return [...new Set(tokens.filter((token) => token.length >= 2))]
}

function buildPreview(body: string, normalizedTerm: string): string {
  const raw = trimSearchBody(body)
  if (!raw) return ''
  if (!normalizedTerm) {
    return raw.slice(0, 160)
  }
  const normalizedBody = normalizeSearchText(raw)
  const normalizedIndex = normalizedBody.indexOf(normalizedTerm)
  if (normalizedIndex < 0) {
    return raw.slice(0, 160)
  }
  const start = Math.max(0, normalizedIndex - 40)
  const end = Math.min(raw.length, normalizedIndex + normalizedTerm.length + 80)
  return raw.slice(start, end)
}

// --- 索引管理 ---

function removeIndexedEvent(eventId: string): void {
  const existing = searchEventDocs.get(eventId)
  if (!existing) return

  const tokens = searchEventTokens.get(eventId) || []
  for (const token of tokens) {
    const eventIds = searchInvertedIndex.get(token)
    if (!eventIds) continue
    eventIds.delete(eventId)
    if (eventIds.size === 0) {
      searchInvertedIndex.delete(token)
    }
  }

  const roomEventIds = searchRoomEventIds.get(existing.roomId)
  if (roomEventIds) {
    searchRoomEventIds.set(
      existing.roomId,
      roomEventIds.filter((id) => id !== eventId)
    )
  }

  searchEventTokens.delete(eventId)
  searchEventDocs.delete(eventId)
}

function upsertIndexedEvent(doc: SearchEventDoc): void {
  const body = trimSearchBody(String(doc.body || ''))
  if (!doc.eventId || !doc.roomId || !body) return

  removeIndexedEvent(doc.eventId)

  const normalizedBody = normalizeSearchText(body)
  const indexedDoc: IndexedSearchEventDoc = {
    ...doc,
    body,
    normalizedBody
  }
  searchEventDocs.set(doc.eventId, indexedDoc)

  const tokens = tokenizeSearchText(body)
  searchEventTokens.set(doc.eventId, tokens)
  for (const token of tokens) {
    const eventIds = searchInvertedIndex.get(token) || new Set<string>()
    eventIds.add(doc.eventId)
    searchInvertedIndex.set(token, eventIds)
  }

  const roomEventIds = searchRoomEventIds.get(doc.roomId) || []
  roomEventIds.push(doc.eventId)
  roomEventIds.sort((left, right) => {
    const leftTs = searchEventDocs.get(left)?.timestamp || 0
    const rightTs = searchEventDocs.get(right)?.timestamp || 0
    return leftTs - rightTs
  })
  searchRoomEventIds.set(doc.roomId, roomEventIds)
}

function trimSearchIndexLimits(): void {
  for (const [roomId, eventIds] of searchRoomEventIds.entries()) {
    while (eventIds.length > MAX_INDEXED_EVENTS_PER_ROOM) {
      const oldestEventId = eventIds.shift()
      if (oldestEventId) {
        removeIndexedEvent(oldestEventId)
      }
    }
    if (eventIds.length === 0) {
      searchRoomEventIds.delete(roomId)
    }
  }

  while (searchEventDocs.size > MAX_INDEXED_EVENTS_GLOBAL) {
    let oldestEventId = ''
    let oldestTimestamp = Number.POSITIVE_INFINITY
    for (const [eventId, doc] of searchEventDocs.entries()) {
      if (doc.timestamp < oldestTimestamp) {
        oldestTimestamp = doc.timestamp
        oldestEventId = eventId
      }
    }
    if (!oldestEventId) break
    removeIndexedEvent(oldestEventId)
  }
}

function getMessageCandidates(normalizedTerm: string): IndexedSearchEventDoc[] {
  const tokens = tokenizeSearchText(normalizedTerm)
  if (tokens.length === 0) {
    return Array.from(searchEventDocs.values())
  }

  let candidateIds: Set<string> | null = null
  for (const token of tokens) {
    const eventIds = searchInvertedIndex.get(token)
    if (!eventIds) {
      return []
    }
    candidateIds = candidateIds
      ? new Set(Array.from(candidateIds as Set<string>).filter((eventId) => eventIds.has(eventId)))
      : new Set<string>(eventIds)
  }

  return [...(candidateIds || new Set<string>())]
    .map((eventId) => searchEventDocs.get(eventId))
    .filter((doc): doc is IndexedSearchEventDoc => Boolean(doc))
}

function scoreMessageHit(doc: IndexedSearchEventDoc, normalizedTerm: string): number {
  let score = 0
  if (doc.normalizedBody === normalizedTerm) score += 300
  if (doc.normalizedBody.startsWith(normalizedTerm)) score += 200
  if (doc.normalizedBody.includes(normalizedTerm)) score += 100
  score += Math.floor(doc.timestamp / 100000000)
  return score
}

// --- 内存管理 ---
//
// 原 `checkMemoryUsage()` + `trimRoomTimelines()` 是「worker JS 堆超 400MB 时裁剪
// SDK room timeline」的内存看门狗。Batch 3.2 取证确认 worker 侧**从不持有 MatrixClient**
// ⇒ `trimRoomTimelines()` 的 `if (!state.client) return` 恒早退、且 worker 里也不存在 rooms，
// 即整段看门狗从未有过任何动作；索引侧的内存上界由 `trimSearchIndexLimits()` 独立保证
// （在 upsert 路径上生效）。故整体删除，而不是留一段看起来在兜底的死代码。

// --- DB 加载 ---

async function loadSearchIndexFromDB(): Promise<void> {
  if (isSearchIndexLoaded) return

  try {
    const [rooms, events] = await Promise.all([loadRoomsFromDB(), loadEventsFromDB()])

    for (const room of rooms) {
      searchRoomDocs.set(room.roomId, room)
      searchRoomNames.set(room.roomId, normalizeSearchText(room.name || room.roomId))
    }

    for (const event of events) {
      upsertIndexedEvent(event)
    }

    trimSearchIndexLimits()
    isSearchIndexLoaded = true
    logger.info(`Loaded search index: ${rooms.length} rooms, ${events.length} events`)
  } catch (error) {
    logger.error('Failed to load search index from DB', error)
  }
}

// --- 导出的 handler 函数 ---

export function handleSearchReset(): void {
  searchRoomDocs.clear()
  searchRoomNames.clear()
  searchEventDocs.clear()
  searchEventTokens.clear()
  searchRoomEventIds.clear()
  searchInvertedIndex.clear()
  void clearAllSearchData()
}

export function handleSearchUpsertRooms(payload: { rooms?: SearchRoomDoc[] }): void {
  const rooms = Array.isArray(payload?.rooms) ? payload.rooms : []
  for (const room of rooms) {
    if (!room.roomId) continue
    searchRoomDocs.set(room.roomId, room)
    searchRoomNames.set(room.roomId, normalizeSearchText(room.name || room.roomId))
  }
  void saveRoomsToDB(rooms)
}

/**
 * 设置搜索索引的加密密钥（F-4 / D3）。
 *
 * `key = null` 时**清空**索引库：D3 之前写入的是明文记录，不能留在磁盘上。
 * 清空后索引退化为内存态，下次登录提供密钥时会重建。
 */
export function handleSearchSetKey(payload: { key?: string | null }): void {
  const key = typeof payload?.key === 'string' && payload.key.length > 0 ? fromBase64(payload.key) : null
  setSearchIndexKey(key)
  if (!key) {
    void clearAllSearchData()
  }
}

export function handleSearchBootstrapRooms(payload: { rooms?: SearchRoomDoc[] }): void {
  handleSearchUpsertRooms(payload)
}

export function handleSearchBootstrapEvents(payload: { events?: SearchEventDoc[] }): void {
  const events = Array.isArray(payload?.events) ? payload.events : []
  for (const event of events) {
    upsertIndexedEvent(event)
  }
  trimSearchIndexLimits()
  void saveEventsToDB(events)
}

export function handleSearchUpsertEvents(payload: { events?: SearchEventDoc[] }): void {
  const events = Array.isArray(payload?.events) ? payload.events : []
  for (const event of events) {
    upsertIndexedEvent(event)
  }
  trimSearchIndexLimits()
  void saveEventsToDB(events)
}

export function handleSearchRedactEvent(payload: { eventId?: string }): void {
  if (!payload?.eventId) return
  removeIndexedEvent(payload.eventId)
  void deleteEventFromDB(payload.eventId)
}

export function handleSearchRemoveRoom(payload: { roomId?: string }): void {
  if (!payload?.roomId) return
  searchRoomDocs.delete(payload.roomId)
  searchRoomNames.delete(payload.roomId)
  const eventIds = searchRoomEventIds.get(payload.roomId) || []
  for (const eventId of eventIds) {
    removeIndexedEvent(eventId)
  }
  searchRoomEventIds.delete(payload.roomId)
  void deleteRoomFromDB(payload.roomId)
}

export function handleSearchQuery(payload: SearchQueryPayload): SearchQueryResult {
  const normalizedTerm = normalizeSearchText(payload?.term || '')
  const limit = payload?.limit || 20
  const offset = payload?.offset || 0
  if (!normalizedTerm) {
    return payload.scope === 'rooms' ? { rooms: [] } : { messages: [] }
  }

  if (payload.scope === 'rooms') {
    const rooms = Array.from(searchRoomDocs.values())
      .filter((room) => (searchRoomNames.get(room.roomId) || '').includes(normalizedTerm))
      .map<SearchRoomHit>((room) => ({
        roomId: room.roomId,
        roomName: room.name || room.roomId,
        score: (searchRoomNames.get(room.roomId) || '').startsWith(normalizedTerm) ? 200 : 100
      }))
      .sort((left, right) => right.score - left.score || left.roomName.localeCompare(right.roomName))

    return {
      rooms: rooms.slice(offset, offset + limit)
    }
  }

  const messages = getMessageCandidates(normalizedTerm)
    .filter((doc) => (!payload.roomId || doc.roomId === payload.roomId) && doc.normalizedBody.includes(normalizedTerm))
    .map<SearchMessageHit>((doc) => ({
      eventId: doc.eventId,
      roomId: doc.roomId,
      sender: doc.sender,
      timestamp: doc.timestamp,
      preview: buildPreview(doc.body, normalizedTerm),
      score: scoreMessageHit(doc, normalizedTerm)
    }))
    .sort((left, right) => right.score - left.score || right.timestamp - left.timestamp)

  return {
    messages: messages.slice(offset, offset + limit)
  }
}

export function handleSearchStats(): SearchIndexStats {
  return {
    rooms: searchRoomDocs.size,
    events: searchEventDocs.size,
    tokens: searchInvertedIndex.size
  }
}

// --- Worker 生命周期管理 ---

/**
 * 初始化搜索索引（从 IndexedDB 加载本地搜索索引）
 *
 * 原先还会 `setInterval(checkMemoryUsage, 60s)`，随内存看门狗一并删除；索引本身的内存上界
 * 由 `trimSearchIndexLimits()` 在写入路径上保证。worker 的生命周期由主线程
 * `MatrixWorkerHost.terminate()` 结束（登出链路），无需在 worker 内自停。
 */
export async function initSearchEngine(): Promise<void> {
  await loadSearchIndexFromDB()
}
