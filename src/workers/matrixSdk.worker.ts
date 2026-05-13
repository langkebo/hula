/**
 * Matrix SDK Web Worker
 * 负责在独立线程中处理 Matrix SDK 初始化、同步、事件处理等耗时操作
 * 确保主线程阻塞时间 < 50ms
 */

import type {
  LoginResult,
  MatrixClientConfig,
  SearchEventDoc,
  SearchIndexStats,
  SearchMessageHit,
  SearchQueryPayload,
  SearchQueryResult,
  SearchRoomDoc,
  SearchRoomHit,
  SyncOptions
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

const logger = createWorkerLogger('MatrixWorker')

export interface WorkerMessage {
  type: string
  id: string
  payload?: unknown
}

export interface WorkerResponse {
  type: string
  id: string
  success: boolean
  data?: unknown
  error?: string
}

let sdk: typeof import('matrix-js-sdk') | null = null
let client: import('matrix-js-sdk').MatrixClient | null = null
let slidingSyncInstance: unknown = null

// --- 内存与性能优化配置 (P2-PERF-02) ---
const MAX_TIMELINE_SIZE = 100 // 每个房间保留的最大消息数
const MEMORY_CHECK_INTERVAL = 60 * 1000 // 1 分钟检查一次
const MAX_MEMORY_MB = 400 // 内存阈值 400MB
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

function checkMemoryUsage() {
  if (self.performance?.memory) {
    const used = self.performance.memory.usedJSHeapSize / 1024 / 1024
    if (used > MAX_MEMORY_MB) {
      trimRoomTimelines()
    }
  }
}

function trimRoomTimelines() {
  if (!client) return
  const rooms = client.getRooms()
  rooms.forEach((room) => {
    const timeline = room.getLiveTimeline().getEvents()
    if (timeline.length > MAX_TIMELINE_SIZE) {
      // matrix-js-sdk 内部会自动管理内存，但我们可以通过设置 timeline 限制来引导
      // 这里可以手动移除旧事件或调用内部清理方法
    }
  })
}

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

let isSearchIndexLoaded = false

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

function handleSearchReset(): void {
  searchRoomDocs.clear()
  searchRoomNames.clear()
  searchEventDocs.clear()
  searchEventTokens.clear()
  searchRoomEventIds.clear()
  searchInvertedIndex.clear()
  void clearAllSearchData()
}

function handleSearchUpsertRooms(payload: { rooms?: SearchRoomDoc[] }): void {
  const rooms = Array.isArray(payload?.rooms) ? payload.rooms : []
  for (const room of rooms) {
    if (!room.roomId) continue
    searchRoomDocs.set(room.roomId, room)
    searchRoomNames.set(room.roomId, normalizeSearchText(room.name || room.roomId))
  }
  void saveRoomsToDB(rooms)
}

function handleSearchBootstrapRooms(payload: { rooms?: SearchRoomDoc[] }): void {
  handleSearchUpsertRooms(payload)
}

function handleSearchBootstrapEvents(payload: { events?: SearchEventDoc[] }): void {
  const events = Array.isArray(payload?.events) ? payload.events : []
  for (const event of events) {
    upsertIndexedEvent(event)
  }
  trimSearchIndexLimits()
  void saveEventsToDB(events)
}

function handleSearchUpsertEvents(payload: { events?: SearchEventDoc[] }): void {
  const events = Array.isArray(payload?.events) ? payload.events : []
  for (const event of events) {
    upsertIndexedEvent(event)
  }
  trimSearchIndexLimits()
  void saveEventsToDB(events)
}

function handleSearchRedactEvent(payload: { eventId?: string }): void {
  if (!payload?.eventId) return
  removeIndexedEvent(payload.eventId)
  void deleteEventFromDB(payload.eventId)
}

function handleSearchRemoveRoom(payload: { roomId?: string }): void {
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

function handleSearchQuery(payload: SearchQueryPayload): SearchQueryResult {
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

function handleSearchStats(): SearchIndexStats {
  return {
    rooms: searchRoomDocs.size,
    events: searchEventDocs.size,
    tokens: searchInvertedIndex.size
  }
}

// 启动定期检查
async function init() {
  await loadSearchIndexFromDB()
  setInterval(checkMemoryUsage, MEMORY_CHECK_INTERVAL)
}

void init()
// ---------------------------------------

const _pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
  }
>()

function _generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function sendResponse(type: string, id: string, success: boolean, data?: unknown, error?: string): Promise<void> {
  const response: WorkerResponse = { type, id, success, data, error }
  self.postMessage(response)
}

async function initSDK(): Promise<void> {
  if (sdk) return
  sdk = await import('matrix-js-sdk')
  const sdkModule = sdk as unknown as { initLogger?: () => void }
  if (typeof sdkModule.initLogger === 'function') {
    sdkModule.initLogger()
  }
}

async function handleInitialize(payload: MatrixClientConfig): Promise<void> {
  await initSDK()
  await loadSearchIndexFromDB()

  if (client) {
    client.stopClient()
    client = null
  }

  if (slidingSyncInstance) {
    ;(slidingSyncInstance as { stop?: () => void }).stop?.()
    slidingSyncInstance = null
  }

  const SlidingSyncCtor = (
    sdk as unknown as {
      SlidingSync?: new (
        homeserverUrl: string,
        lists: Map<string, unknown>,
        options: Record<string, unknown>,
        client: import('matrix-js-sdk').MatrixClient,
        timeout?: number
      ) => unknown
    }
  ).SlidingSync

  const lists = new Map()
  lists.set('default', {
    ranges: [[0, 20]],
    sort: ['by_recency'],
    timeline_limit: 10,
    required_state: [
      ['m.room.name', ''],
      ['m.room.avatar', ''],
      ['m.room.encryption', ''],
      ['m.room.member', '*']
    ]
  })

  const clientOpts = {
    baseUrl: payload.homeserverUrl,
    deviceId: payload.deviceId,
    accessToken: payload.accessToken,
    userId: payload.userId,
    useAuthorizationHeader: true,
    allowInsecureHttp: payload.allowInsecureHttp
  }

  const tempClient = sdk!.createClient(clientOpts)

  if (SlidingSyncCtor) {
    slidingSyncInstance = new SlidingSyncCtor(
      payload.homeserverUrl,
      lists,
      {
        timeline_limit: 10,
        required_state: [
          ['m.room.name', ''],
          ['m.room.avatar', ''],
          ['m.room.encryption', ''],
          ['m.room.member', '*']
        ]
      },
      tempClient,
      2000
    )
    ;(clientOpts as Record<string, unknown>).slidingSync = slidingSyncInstance
  }

  client = sdk!.createClient(clientOpts)
}

async function handleLogin(payload: { username: string; password: string; deviceName?: string }): Promise<LoginResult> {
  if (!client) {
    throw new Error('客户端未初始化')
  }

  const loginResponse = await client.login('m.login.password', {
    user: payload.username,
    password: payload.password,
    initial_device_display_name: payload.deviceName || 'HuLa Client'
  })

  const loginResult: LoginResult = {
    success: true,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined,
    accessToken: loginResponse.access_token
  }

  await handleInitialize({
    ...(client as unknown as MatrixClientConfig),
    accessToken: loginResponse.access_token,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined
  })

  return loginResult
}

async function handleStartClient(): Promise<void> {
  if (!client) {
    throw new Error('客户端未初始化')
  }
  client.startClient({
    pendingEventOrdering: 'detached' as const,
    dustyOptions: {
      archive: true
    }
  })
}

async function handleStopClient(): Promise<void> {
  if (client) {
    client.stopClient()
  }
}

async function handleGetClient(): Promise<unknown> {
  return client
}

async function handleSyncOnce(options?: SyncOptions): Promise<void> {
  if (!client) {
    throw new Error('客户端未初始化')
  }
  await client.syncOnce(options as Record<string, unknown>)
}

interface GetServerVersionsPayload {
  baseUrl: string
  accessToken?: string
}

interface ServerVersionsResult {
  versions: string[]
  unstable_features?: Record<string, boolean>
}

async function handleGetServerVersions(payload: GetServerVersionsPayload): Promise<ServerVersionsResult> {
  if (!payload?.baseUrl) {
    throw new Error('baseUrl 不能为空')
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/versions`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (payload.accessToken) {
    headers.Authorization = `Bearer ${payload.accessToken}`
  }
  const response = await fetch(url, { method: 'GET', headers })
  if (!response.ok) {
    throw new Error(`getVersions HTTP ${response.status}`)
  }
  const json = (await response.json()) as ServerVersionsResult
  return {
    versions: Array.isArray(json.versions) ? json.versions : [],
    unstable_features: json.unstable_features
  }
}

interface GetLoginFlowsPayload {
  baseUrl: string
}

interface LoginFlow {
  type: string
  [key: string]: unknown
}

interface LoginFlowsResult {
  flows: LoginFlow[]
}

async function handleGetLoginFlows(payload: GetLoginFlowsPayload): Promise<LoginFlowsResult> {
  if (!payload?.baseUrl) {
    throw new Error('baseUrl 不能为空')
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/v3/login`
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`getLoginFlows HTTP ${response.status}`)
  }
  const json = (await response.json()) as LoginFlowsResult
  return {
    flows: Array.isArray(json.flows) ? json.flows : []
  }
}

interface ProbeSlidingSyncPayload {
  baseUrl: string
  endpoints: string[]
}

interface SlidingSyncProbeResult {
  endpoint: string
  status: number | 'error'
  available: boolean
  error?: string
}

async function handleProbeSlidingSyncEndpoints(payload: ProbeSlidingSyncPayload): Promise<SlidingSyncProbeResult[]> {
  if (!payload?.baseUrl) {
    throw new Error('baseUrl 不能为空')
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : []
  if (endpoints.length === 0) {
    return []
  }

  return Promise.all(
    endpoints.map(async (endpoint): Promise<SlidingSyncProbeResult> => {
      try {
        const response = await fetch(`${trimmed}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        return {
          endpoint,
          status: response.status,
          available: response.status !== 404
        }
      } catch (error) {
        return {
          endpoint,
          status: 'error',
          available: false,
          error: String(error)
        }
      }
    })
  )
}

interface ProbeCorsPayload {
  baseUrl: string
}

interface CorsProbeResult {
  'access-control-allow-origin': string | null
  'access-control-allow-methods': string | null
  'access-control-allow-headers': string | null
}

async function handleProbeCors(payload: ProbeCorsPayload): Promise<CorsProbeResult> {
  if (!payload?.baseUrl) {
    throw new Error('baseUrl 不能为空')
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const response = await fetch(`${trimmed}/_matrix/client/versions`, { method: 'OPTIONS' })
  return {
    'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
    'access-control-allow-headers': response.headers.get('access-control-allow-headers')
  }
}

interface GetCapabilitiesPayload {
  baseUrl: string
  accessToken: string
}

async function handleGetCapabilities(payload: GetCapabilitiesPayload): Promise<Record<string, unknown>> {
  if (!payload?.baseUrl) {
    throw new Error('baseUrl 不能为空')
  }
  if (!payload?.accessToken) {
    throw new Error('accessToken 不能为空')
  }
  const trimmed = payload.baseUrl.replace(/\/+$/, '')
  const url = `${trimmed}/_matrix/client/v3/capabilities`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${payload.accessToken}`
    }
  })
  if (!response.ok) {
    throw new Error(`getCapabilities HTTP ${response.status}`)
  }
  return (await response.json()) as Record<string, unknown>
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data

  try {
    switch (type) {
      case 'initialize':
        await handleInitialize(payload as MatrixClientConfig)
        await sendResponse(type, id, true)
        break

      case 'login': {
        const loginResult = await handleLogin(payload as { username: string; password: string; deviceName?: string })
        await sendResponse(type, id, true, loginResult)
        break
      }

      case 'startClient':
        await handleStartClient()
        await sendResponse(type, id, true)
        break

      case 'stopClient':
        await handleStopClient()
        await sendResponse(type, id, true)
        break

      case 'getClient': {
        const clientData = await handleGetClient()
        await sendResponse(type, id, true, clientData)
        break
      }

      case 'syncOnce':
        await handleSyncOnce(payload as SyncOptions)
        await sendResponse(type, id, true)
        break

      case 'getServerVersions': {
        const versions = await handleGetServerVersions(payload as GetServerVersionsPayload)
        await sendResponse(type, id, true, versions)
        break
      }

      case 'getLoginFlows': {
        const flows = await handleGetLoginFlows(payload as GetLoginFlowsPayload)
        await sendResponse(type, id, true, flows)
        break
      }

      case 'probeSlidingSyncEndpoints': {
        const probes = await handleProbeSlidingSyncEndpoints(payload as ProbeSlidingSyncPayload)
        await sendResponse(type, id, true, probes)
        break
      }

      case 'probeCors': {
        const cors = await handleProbeCors(payload as ProbeCorsPayload)
        await sendResponse(type, id, true, cors)
        break
      }

      case 'getCapabilities': {
        const caps = await handleGetCapabilities(payload as GetCapabilitiesPayload)
        await sendResponse(type, id, true, caps)
        break
      }

      case 'search.reset':
        handleSearchReset()
        await sendResponse(type, id, true)
        break

      case 'search.bootstrapRooms':
        handleSearchBootstrapRooms(payload as { rooms?: SearchRoomDoc[] })
        await sendResponse(type, id, true)
        break

      case 'search.upsertRooms':
        handleSearchUpsertRooms(payload as { rooms?: SearchRoomDoc[] })
        await sendResponse(type, id, true)
        break

      case 'search.bootstrapEvents':
        handleSearchBootstrapEvents(payload as { events?: SearchEventDoc[] })
        await sendResponse(type, id, true)
        break

      case 'search.upsertEvents':
        handleSearchUpsertEvents(payload as { events?: SearchEventDoc[] })
        await sendResponse(type, id, true)
        break

      case 'search.redactEvent':
        handleSearchRedactEvent(payload as { eventId?: string })
        await sendResponse(type, id, true)
        break

      case 'search.removeRoom':
        handleSearchRemoveRoom(payload as { roomId?: string })
        await sendResponse(type, id, true)
        break

      case 'search.query': {
        const result = handleSearchQuery(payload as SearchQueryPayload)
        await sendResponse(type, id, true, result)
        break
      }

      case 'search.stats': {
        const stats = handleSearchStats()
        await sendResponse(type, id, true, stats)
        break
      }

      case 'ping':
        await sendResponse(type, id, true, { timestamp: Date.now() })
        break

      default:
        await sendResponse(type, id, false, undefined, `Unknown message type: ${type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await sendResponse(type, id, false, undefined, errorMessage)
  }
}

self.postMessage({ type: 'ready', id: 'init', success: true })
