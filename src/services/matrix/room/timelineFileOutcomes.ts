import type { MatrixEncryptedAttachmentLike } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import { unknownToObject } from '@/utils/typeGuard'
import { readUrlField, toOptionalFiniteNumber, toOptionalString } from './timelineOutcomes'

/**
 * 房间文件条目（`/messages` 分页扫描出的附件消息）。
 *
 * 只收 `m.file` / `m.image` / `m.video` / `m.audio`；未知字段一律给 null，
 * 不用 0 / 空串伪装「未知」，避免前端把缺元数据渲染成「0 字节」。
 */
export interface RoomFileEntry {
  eventId: string
  sender: string
  /** 发送时间（ms）；缺失时为 null */
  timestamp: number | null
  /** 附件原始地址（通常为 `mxc://…`；服务端给 http(s) 时保持原样） */
  url: string
  /** `mxc://` 解析后的可访问地址；无法解析时为 null */
  httpUrl: string | null
  /** 文件名（`content.body`）；缺失时为空串 */
  name: string
  /** 字节数；元数据缺失时为 null */
  size: number | null
  /** MIME 类型；缺失时为 null */
  mimeType: string | null
  kind: 'file' | 'image' | 'video' | 'audio'
  /** 是否为加密附件（E2EE 房间的 `content.file`） */
  encrypted: boolean
  /**
   * E2EE 附件的解密描述符（`content.file` 原样透出）；非加密附件为 null。
   *
   * 下载加密媒体必须把该描述符交给 `MatrixAttachmentDecryptionService`，
   * 只凭 mxc 地址无法解密，因此不能在这里丢弃。
   */
  encryptedFile: MatrixEncryptedAttachmentLike | null
}

/** 单页扫描结果：`nextToken` 非空表示还有更早的历史可继续翻。 */
export interface RoomFilesPage {
  files: RoomFileEntry[]
  /** 继续向更早翻页的 token；null 表示已到房间开头 */
  nextToken: string | null
}

export type RoomFilesOutcome =
  /** 分页成功；`page.files` 可能为空（本页全是文本消息），此时看 `nextToken` 判断是否还有历史 */
  | { status: 'ok'; page: RoomFilesPage }
  /** 端点不存在（该 homeserver 不支持 `/messages` 过滤查询） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（无权限、网络错误等） */
  | { status: 'error' }

const FILE_MESSAGE_KINDS: Record<string, RoomFileEntry['kind']> = {
  'm.file': 'file',
  'm.image': 'image',
  'm.video': 'video',
  'm.audio': 'audio'
}

/**
 * 把单条 `m.room.message` 归一化为文件条目。
 *
 * 兼容 E2EE 房间的 `content.file = { url, key, iv, … }`（此时 `content.info`
 * 可能缺失，尺寸回落到 `content.file.size`）；非附件消息返回 null。
 */
export function normalizeRoomFileEvent(
  raw: unknown,
  resolveUrl: (mxcUrl: string) => string | null
): RoomFileEntry | null {
  const event = unknownToObject(raw)
  if (!event) return null
  const eventId = readUrlField(event, ['event_id'])
  if (!eventId) return null
  const content = unknownToObject(event.content)
  if (!content) return null

  const kind = FILE_MESSAGE_KINDS[readUrlField(content, ['msgtype'])]
  if (!kind) return null

  const encryptedFile = unknownToObject(content.file)
  const url = readUrlField(encryptedFile ?? content, ['url'])
  if (!url) return null
  const info = unknownToObject(content.info)
  return {
    eventId,
    sender: readUrlField(event, ['sender']),
    timestamp: toOptionalFiniteNumber(event.origin_server_ts),
    url,
    httpUrl: url.startsWith('mxc://') ? resolveUrl(url) : url,
    name: readUrlField(content, ['body']),
    size: toOptionalFiniteNumber(info?.size) ?? toOptionalFiniteNumber(encryptedFile?.size),
    mimeType: toOptionalString(info?.mimetype),
    kind,
    encrypted: encryptedFile !== null,
    encryptedFile
  }
}

/**
 * 把 `/messages` 响应归一化为文件分页结果。
 *
 * 响应缺少 `chunk` 数组时返回 null（协议违例，由调用方判为 `error`）；
 * 空 `chunk` / 全文本页都是合法的 `ok` + 空数组。
 */
export function normalizeRoomFilesPage(
  raw: unknown,
  resolveUrl: (mxcUrl: string) => string | null
): RoomFilesPage | null {
  const record = unknownToObject(raw)
  if (!record || !Array.isArray(record.chunk)) return null

  const files: RoomFileEntry[] = []
  const seen = new Set<string>()
  for (const item of record.chunk) {
    const entry = normalizeRoomFileEvent(item, resolveUrl)
    if (!entry || seen.has(entry.eventId)) continue
    seen.add(entry.eventId)
    files.push(entry)
  }
  return { files, nextToken: toOptionalString(record.end) }
}
