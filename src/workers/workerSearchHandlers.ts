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
  saveRoomsToDB
} from './searchIndexDb'
import { createWorkerLogger } from './workerLogger'
import { state } from './workerState'

const logger = createWorkerLogger('MatrixWorker')

// --- 内存与性能优化配置 ---
const MAX_TIMELINE_SIZE = 100
const MEMORY_CHECK_INTERVAL = 60 * 1000
const MAX_MEMORY_MB = 400
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

function checkMemoryUsage() {
  if (self.performance?.memory) {
    const used = self.performance.memory.usedJSHeapSize / 1024 / 1024
    if (used > MAX_MEMORY_MB) {
      trimRoomTimelines()
    }
  }
}

function trimRoomTimelines() {
  if (!state.client) return
  const rooms = state.client.getRooms()
  for (const room of rooms) {
    const events = room.getLiveTimeline().getEvents()
    if (events.length <= MAX_TIMELINE_SIZE) continue
    const excess = events.length - MAX_TIMELINE_SIZE
    for (let i = 0; i < excess; i++) {
      const event = events[i]
      if (!event) break
      const eventId = event.getId()
      if (!eventId) continue
      try {
        room.removeEvent(eventId)
      } catch {
        events.splice(i, 1)
        i--
      }
    }
  }
}

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
 * 初始化搜索索引（从 IndexedDB 加载 + 启动内存检查定时器）
 */
export async function initSearchEngine(): Promise<void> {
  await loadSearchIndexFromDB()
  state.memoryCheckIntervalId = setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL)
}

/**
 * 停止内存检查定时器
 */
export function stopSearchEngine(): void {
  if (state.memoryCheckIntervalId !== null) {
    clearInterval(state.memoryCheckIntervalId)
    state.memoryCheckIntervalId = null
  }
}
