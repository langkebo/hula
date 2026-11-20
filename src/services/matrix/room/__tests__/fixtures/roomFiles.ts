/**
 * 房间文件分页测试夹具。
 *
 * 类型来自真实契约：`matrixRoomTimelineService.getRoomFiles()` 的返回，即
 * `src/services/matrix/room/timelineFileOutcomes.ts` 的
 * `RoomFileEntry` / `RoomFilesPage` / `RoomFilesOutcome`。
 *
 * 文件条目里的「未知元数据」是 `null` 而不是 0 / 空串（缺尺寸不能渲染成 0 B），
 * 夹具用契约默认值兜底，覆盖项按需传入。
 */
import type { RoomFileEntry, RoomFilesOutcome } from '../../timelineFileOutcomes'

/** 单条文件消息（默认是一份未加密的 PDF） */
export function makeRoomFileEntry(overrides: Partial<RoomFileEntry> = {}): RoomFileEntry {
  return {
    eventId: '$file1',
    sender: '@alice:example.org',
    timestamp: 1795000000000,
    url: 'mxc://example.org/media1',
    httpUrl: 'https://example.org/_matrix/media/media1',
    name: 'report.pdf',
    size: 2048,
    mimeType: 'application/pdf',
    kind: 'file',
    encrypted: false,
    encryptedFile: null,
    ...overrides
  }
}

/** 成功的一页：`nextToken` 非空表示还有更早历史可继续翻 */
export function makeRoomFilesOutcome(files: RoomFileEntry[], nextToken: string | null = null): RoomFilesOutcome {
  return { status: 'ok', page: { files, nextToken } }
}

/** 成功但本页无附件（空页不等于空房间，是否到底仍看 `nextToken`） */
export function makeEmptyRoomFilesOutcome(nextToken: string | null = null): RoomFilesOutcome {
  return makeRoomFilesOutcome([], nextToken)
}

/** 端点存在但本次读取失败（无权限、网络错误等） */
export function makeRoomFilesError(): RoomFilesOutcome {
  return { status: 'error' }
}

/** 该 homeserver 不支持 `/messages` 过滤查询 */
export function makeRoomFilesUnsupported(): RoomFilesOutcome {
  return { status: 'unsupported' }
}
