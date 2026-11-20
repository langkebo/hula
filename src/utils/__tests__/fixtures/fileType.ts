/**
 * 文件类型探测夹具。
 *
 * 契约来源：`file-type` 的 `FileTypeResult`——`PathUtil.detectRemoteFileType()` 的返回载荷
 * （`{ ext, mime }`，探测失败时为 `undefined`）。
 */
import type { FileTypeResult } from 'file-type'

export function makeFileTypeResult(overrides: Partial<FileTypeResult> = {}): FileTypeResult {
  return { ext: 'bin', mime: 'application/octet-stream', ...overrides }
}
