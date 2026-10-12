/**
 * Worker 消息边界校验（SC-06）
 *
 * Worker 通过 postMessage 接收主线程消息，此前直接按 `type` 查表并用 `as`
 * 断言 payload，缺少运行时 schema 校验。本模块提供纯函数校验：
 *   - 校验信封（type/id 必须为非空字符串）；
 *   - 校验各消息类型的 payload 结构；
 *   - 未知字段一律忽略，保持向后兼容（与各 handler 现有的宽容解析一致）。
 *
 * 设计约束：
 *   - 全部为纯函数，无副作用，可在 node 环境直接单测；
 *   - 未在 `payloadValidators` 中登记的类型（含未知类型）只校验信封，
 *     未知类型仍交由分发表返回 "Unknown message type"。
 */

import type { WorkerMessage } from './matrixWorkerTypes'

export interface ValidatedWorkerMessage {
  message: WorkerMessage
  payload: unknown
}

export type WorkerMessageValidationResult =
  | { ok: true; value: ValidatedWorkerMessage }
  | { ok: false; error: string; type: string; id: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null
}

function requireBaseUrl(payload: unknown): string | null {
  const record = asRecord(payload)
  if (!record) return 'payload must be an object'
  if (!isNonEmptyString(record.baseUrl)) return 'baseUrl must be a non-empty string'
  return null
}

function validateRoomsPayload(payload: unknown): string | null {
  if (payload === undefined) return null
  const record = asRecord(payload)
  if (!record) return 'payload must be an object'
  if (record.rooms === undefined) return null
  if (!Array.isArray(record.rooms)) return 'rooms must be an array'
  if (!record.rooms.every((item) => isPlainObject(item))) return 'rooms must be an array of objects'
  return null
}

function validateEventsPayload(payload: unknown): string | null {
  if (payload === undefined) return null
  const record = asRecord(payload)
  if (!record) return 'payload must be an object'
  if (record.events === undefined) return null
  if (!Array.isArray(record.events)) return 'events must be an array'
  if (!record.events.every((item) => isPlainObject(item))) return 'events must be an array of objects'
  return null
}

function validateOptionalStringField(payload: unknown, field: string): string | null {
  if (payload === undefined) return null
  const record = asRecord(payload)
  if (!record) return 'payload must be an object'
  const value = record[field]
  if (value !== undefined && typeof value !== 'string') return `${field} must be a string`
  return null
}

/**
 * 各消息类型的 payload 校验器。
 * 返回错误描述字符串表示校验失败，返回 null 表示通过。
 *
 * 注意：仅做结构与类型校验，未知字段忽略，不改变既有宽容行为。
 */
const payloadValidators: Record<string, (payload: unknown) => string | null> = {
  initialize: (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (!isNonEmptyString(record.homeserverUrl)) return 'homeserverUrl must be a non-empty string'
    if (record.identityServerUrl !== undefined && typeof record.identityServerUrl !== 'string') {
      return 'identityServerUrl must be a string'
    }
    if (record.deviceId !== undefined && typeof record.deviceId !== 'string') return 'deviceId must be a string'
    if (record.accessToken !== undefined && typeof record.accessToken !== 'string')
      return 'accessToken must be a string'
    if (record.userId !== undefined && typeof record.userId !== 'string') return 'userId must be a string'
    if (record.allowInsecureHttp !== undefined && typeof record.allowInsecureHttp !== 'boolean') {
      return 'allowInsecureHttp must be a boolean'
    }
    return null
  },
  login: (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (!isNonEmptyString(record.username)) return 'username must be a non-empty string'
    if (typeof record.password !== 'string') return 'password must be a string'
    if (record.deviceName !== undefined && typeof record.deviceName !== 'string') return 'deviceName must be a string'
    return null
  },
  getServerVersions: (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (!isNonEmptyString(record.baseUrl)) return 'baseUrl must be a non-empty string'
    if (record.accessToken !== undefined && typeof record.accessToken !== 'string')
      return 'accessToken must be a string'
    return null
  },
  getLoginFlows: requireBaseUrl,
  probeCors: requireBaseUrl,
  probeSlidingSyncEndpoints: (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (!isNonEmptyString(record.baseUrl)) return 'baseUrl must be a non-empty string'
    if (!Array.isArray(record.endpoints)) return 'endpoints must be an array'
    if (!record.endpoints.every((endpoint) => typeof endpoint === 'string')) {
      return 'endpoints must be an array of strings'
    }
    return null
  },
  getCapabilities: (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (!isNonEmptyString(record.baseUrl)) return 'baseUrl must be a non-empty string'
    if (!isNonEmptyString(record.accessToken)) return 'accessToken must be a non-empty string'
    return null
  },
  'search.bootstrapRooms': validateRoomsPayload,
  'search.upsertRooms': validateRoomsPayload,
  'search.bootstrapEvents': validateEventsPayload,
  'search.upsertEvents': validateEventsPayload,
  'search.redactEvent': (payload) => validateOptionalStringField(payload, 'eventId'),
  'search.removeRoom': (payload) => validateOptionalStringField(payload, 'roomId'),
  'search.query': (payload) => {
    const record = asRecord(payload)
    if (!record) return 'payload must be an object'
    if (typeof record.term !== 'string') return 'term must be a string'
    if (record.scope !== undefined && record.scope !== 'messages' && record.scope !== 'rooms') {
      return "scope must be 'messages' or 'rooms'"
    }
    if (record.roomId !== undefined && typeof record.roomId !== 'string') return 'roomId must be a string'
    if (record.limit !== undefined && typeof record.limit !== 'number') return 'limit must be a number'
    if (record.offset !== undefined && typeof record.offset !== 'number') return 'offset must be a number'
    return null
  }
}

/**
 * 校验一条来自主线程的 worker 消息。
 *
 * 失败时返回尽力提取到的 type/id（可能是空字符串），以便调用方仍能回一条
 * 带 id 的失败响应，尽量避免主线程 pending 悬挂。
 */
export function validateWorkerMessage(data: unknown): WorkerMessageValidationResult {
  if (!isPlainObject(data)) {
    return { ok: false, error: 'worker message must be an object', type: '', id: '' }
  }

  const rawType = data.type
  const rawId = data.id
  const type = typeof rawType === 'string' ? rawType : ''
  const id = typeof rawId === 'string' ? rawId : ''

  if (!isNonEmptyString(rawType)) {
    return { ok: false, error: 'worker message "type" must be a non-empty string', type, id }
  }
  if (!isNonEmptyString(rawId)) {
    return { ok: false, error: 'worker message "id" must be a non-empty string', type, id }
  }

  const payload = data.payload
  const validatePayload = payloadValidators[type]
  if (validatePayload) {
    const payloadError = validatePayload(payload)
    if (payloadError) {
      return { ok: false, error: `invalid payload for "${type}": ${payloadError}`, type, id }
    }
  }

  return { ok: true, value: { message: { type, id, payload }, payload } }
}
