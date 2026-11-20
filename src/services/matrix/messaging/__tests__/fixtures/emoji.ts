/**
 * 表情包上传测试夹具。
 *
 * 契约来源：`matrixEmojiService.emojiUpload()` 的返回类型
 * （`EmojiUploadResult` 未导出，因此从服务实例方法返回推导）。
 */
import type { matrixEmojiService } from '@/services/matrix/messaging/MatrixEmojiService'

export type EmojiUploadFixture = Awaited<ReturnType<typeof matrixEmojiService.emojiUpload>>

/** 上传自定义表情的结果（`id` / `name` / `url` / `mxcUrl` 均为必填）。 */
export function makeEmojiUploadResult(overrides: Partial<EmojiUploadFixture> = {}): EmojiUploadFixture {
  return { id: 'emote_1', name: '笑脸', url: 'mxc://x', mxcUrl: 'mxc://x', ...overrides }
}
