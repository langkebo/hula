import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MetadataService')

/**
 * 房间外部关联 ID（G-08）。
 *
 * 后端 `GET /_matrix/vendor/v1/rooms/{roomId}/external_ids` 返回
 * `{ type: 'room_alias', value: '#alias:server' }`；SDK 的类型声明写成了
 * `{ provider, external_id }`，与实际响应不一致，因此在此归一化两种形状。
 */
export interface RoomExternalId {
  type: string
  value: string
}

/** 房间服务类型读取结果（ROOM-03）。 */
export type RoomServiceTypesOutcome =
  /** 端点存在且返回了至少一个服务类型 */
  | { status: 'ok'; serviceTypes: string[] }
  /** 端点存在但返回空列表 */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（无权限、房间不存在、网络错误等） */
  | { status: 'error' }

/** 当前用户在某房间的权限快照（B3，只读）。 */
export interface RoomPermissionSnapshot {
  roomId: string
  /** 我的权限等级；后端未返回时为 null（不伪装 0） */
  powerLevel: number | null
  /** 能力位；后端未返回时保持 null（不伪装 false） */
  canSend: boolean | null
  canInvite: boolean | null
  canKick: boolean | null
  canBan: boolean | null
  canRedact: boolean | null
  /** 原始响应，供既有能力面板原样展示 */
  raw: Record<string, unknown>
}

export type RoomPermissionsOutcome =
  | { status: 'ok'; permissions: RoomPermissionSnapshot }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 房间所属空间（B3，只读，用于面包屑/上级空间跳转）。 */
export interface RoomSpaceMembership {
  roomId: string
  name: string
  canonicalAlias: string
  avatarUrl: string
  topic: string
}

export type RoomSpacesOutcome =
  | { status: 'ok'; spaces: RoomSpaceMembership[] }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/**
 * 房间级 TURN 配置（B3，仅供通话连通性诊断）。
 *
 * 刻意不保留 `username` / `password`：凭据不应进入前端缓存与界面。
 */
export interface RoomTurnServerConfig {
  uris: string[]
  ttl: number | null
}

export type RoomTurnServerOutcome =
  | { status: 'ok'; config: RoomTurnServerConfig }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 事件附件地址（ROOM-03，`GET /rooms/{roomId}/event/{eventId}/url`）。 */
export interface RoomEventAttachmentUrl {
  /** 服务端解析出的可直接访问地址 */
  url: string
  /** 原始 MXC URI（若有） */
  mxc: string | null
  contentType: string | null
  filesize: number | null
}

export type RoomEventUrlOutcome =
  | { status: 'ok'; attachment: RoomEventAttachmentUrl }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 从 SDK 抛出的错误中提取 Matrix errcode（部分错误把 errcode 塞在 message 的 JSON 里）。 */
function readErrcode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const record = err as { errcode?: unknown; code?: unknown; message?: unknown }
  if (typeof record.errcode === 'string') return record.errcode
  if (typeof record.code === 'string') return record.code
  if (typeof record.message === 'string') {
    const jsonMatch = record.message.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { errcode?: unknown }
        if (typeof parsed.errcode === 'string') return parsed.errcode
      } catch {
        return null
      }
    }
  }
  return null
}

function readStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

function readBooleanField(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function readFiniteNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toRoomSpaceMembership(entry: unknown): RoomSpaceMembership | null {
  const record = unknownToObject(entry)
  if (!record) return null
  const roomId = readStringField(record, ['room_id', 'roomId'])
  if (!roomId) return null
  return {
    roomId,
    name: readStringField(record, ['name']),
    canonicalAlias: readStringField(record, ['canonical_alias', 'canonicalAlias']),
    avatarUrl: readStringField(record, ['avatar_url', 'avatarUrl']),
    topic: readStringField(record, ['topic'])
  }
}

function toRoomExternalId(entry: unknown): RoomExternalId | null {
  const record = unknownToObject(entry)
  if (!record) return null
  const type = readStringField(record, ['type', 'provider'])
  const value = readStringField(record, ['value', 'external_id'])
  if (!type || !value) return null
  return { type, value }
}

function normalizeExternalIds(raw: unknown): RoomExternalId[] {
  const record = unknownToObject(raw)
  const list = Array.isArray(raw) ? raw : record && Array.isArray(record.external_ids) ? record.external_ids : []
  return list.map(toRoomExternalId).filter((item): item is RoomExternalId => item !== null)
}

/**
 * Room metadata domain service.
 *
 * Read-only room descriptors: version (from `m.room.create` state),
 * capabilities / metadata / turn_server / sync (via synapse-rust
 * authedRequest endpoints).
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMetadataService extends BaseMatrixService {
  async getRoomVersion(roomId: string): Promise<string | null> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return null
      const createEvent = room.currentState?.getStateEvents?.('m.room.create', '')
      const content = createEvent?.getContent?.() as { room_version?: string } | undefined
      return content?.room_version ?? null
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomCapabilities(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomCapabilities(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间能力失败: ${err}`)
      return {}
    }
  }

  async getRoomMetadata(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().getRoomMetadata(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间元数据失败: ${err}`)
      return {}
    }
  }

  /**
   * 获取房间级 TURN 配置（B3，只读，用于通话连通性诊断）。
   *
   * 只保留 `uris` 与 `ttl`，`username` / `password` 一律丢弃；
   * `uris` 清洗后为空归 `empty`，端点缺失归 `unsupported`。
   */
  async getRoomTurnServer(roomId: string): Promise<RoomTurnServerOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().getRoomTurnServer(roomId)
      const record = unknownToObject(result)
      if (!record) return { status: 'empty' }
      const rawUris = Array.isArray(record.uris) ? record.uris : []
      const uris = rawUris.filter((item): item is string => typeof item === 'string' && item.length > 0)
      if (uris.length === 0) return { status: 'empty' }
      return { status: 'ok', config: { uris, ttl: readFiniteNumberField(record, 'ttl') } }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间 TURN 配置查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间 TURN 服务器失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 取事件的**附件地址**（不是 matrix.to 永久链接）：
   * 服务端把 `mxc://` 解析成可直接访问的 http 地址，供「复制附件地址」使用。
   * 无 `url` 且无 `mxc` 归 `empty`；端点缺失（M_UNRECOGNIZED）归 `unsupported`。
   */
  async getRoomEventUrl(roomId: string, eventId: string): Promise<RoomEventUrlOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().getRoomEventUrl(roomId, eventId)
      const record = unknownToObject(result)
      if (!record) return { status: 'empty' }
      const url = typeof record.url === 'string' ? record.url : ''
      const mxc = typeof record.mxc === 'string' ? record.mxc : null
      if (!url && !mxc) return { status: 'empty' }
      return {
        status: 'ok',
        attachment: {
          url,
          mxc,
          contentType: typeof record.content_type === 'string' ? record.content_type : null,
          filesize: readFiniteNumberField(record, 'filesize')
        }
      }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持事件附件地址查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取事件附件地址失败: ${err}`)
      return { status: 'error' }
    }
  }

  async getRoomSync(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.getRoomSummaryManager().getRoomSync(roomId)
      return unknownToObject(result) ?? {}
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间级同步失败: ${err}`)
      return {}
    }
  }

  /**
   * 获取当前用户在某房间的权限快照（B3，只读）。
   *
   * 布尔能力位缺失时保持 `null`（不伪装 `false`），`{}` 归 `empty`；
   * 端点缺失归 `unsupported`，其余失败归 `error`。
   */
  async getRoomPermissions(roomId: string): Promise<RoomPermissionsOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().getRoomPermissions(roomId)
      const record = unknownToObject(result)
      if (!record || Object.keys(record).length === 0) return { status: 'empty' }
      return {
        status: 'ok',
        permissions: {
          roomId: readStringField(record, ['room_id', 'roomId']) || roomId,
          powerLevel: readFiniteNumberField(record, 'power_level'),
          canSend: readBooleanField(record, 'can_send'),
          canInvite: readBooleanField(record, 'can_invite'),
          canKick: readBooleanField(record, 'can_kick'),
          canBan: readBooleanField(record, 'can_ban'),
          canRedact: readBooleanField(record, 'can_redact'),
          raw: record
        }
      }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间权限查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间权限失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取房间所属空间列表（B3，只读，用于面包屑/上级空间跳转）。
   *
   * 脏条目（缺 `room_id`）直接丢弃；空列表归 `empty`，
   * 端点缺失（`M_UNRECOGNIZED`）归 `unsupported`。
   */
  async getRoomSpaces(roomId: string): Promise<RoomSpacesOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().getRoomSpaces(roomId)
      const list = Array.isArray(result) ? result : []
      const spaces = list.map(toRoomSpaceMembership).filter((item): item is RoomSpaceMembership => item !== null)
      return spaces.length > 0 ? { status: 'ok', spaces } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间所属空间查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间所属空间失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取房间外部关联 ID（G-08，只读）。
   *
   * 端点不存在（`M_UNRECOGNIZED`）或读取失败时返回空数组，调用方据此整块不渲染。
   */
  async getRoomExternalIds(roomId: string): Promise<RoomExternalId[]> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomExternalIds(roomId)
      return normalizeExternalIds(result)
    } catch (err) {
      logger.warn(`[MatrixRoom] 获取房间外部关联 ID 失败: ${err}`)
      return []
    }
  }

  /**
   * 获取房间服务类型（ROOM-03，只读）。
   *
   * 后端按房间加密状态与可见性派生：恒含 `messaging`，加密房间追加
   * `encryption`，公开房间追加 `directory`。端点缺失（`M_UNRECOGNIZED`）
   * 归 `unsupported`，其余失败归 `error`，与空列表 `empty` 严格区分。
   */
  async getRoomServiceTypes(roomId: string): Promise<RoomServiceTypesOutcome> {
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().eventOps.getRoomServiceTypes(roomId)
      const record = unknownToObject(result)
      const list = record && Array.isArray(record.service_types) ? record.service_types : []
      const serviceTypes = [
        ...new Set(list.filter((item): item is string => typeof item === 'string' && item.length > 0))
      ]
      return serviceTypes.length > 0 ? { status: 'ok', serviceTypes } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持房间服务类型查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取房间服务类型失败: ${err}`)
      return { status: 'error' }
    }
  }
}

export const matrixRoomMetadataService = new MatrixRoomMetadataService()
