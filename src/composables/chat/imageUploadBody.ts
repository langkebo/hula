/**
 * 图片附件 → m.image 消息体的字段补齐。
 *
 * 上传链本身统一走 FILE 策略（500MB 上限、blob/path 双通道），只在发送时把图片
 * 分流成 m.image。m.image 分支读的是 `fileName`（body）、`mimetype`（小写 t）与
 * `width` / `height`，这三类字段在文件上传链里没有，必须在这里补。
 */

import { readFile } from '@tauri-apps/plugin-fs'
import {
  getFileExtension,
  getImageMimeType,
  isPathUploadFile,
  SUPPORTED_IMAGE_EXTENSIONS,
  type UploadFile
} from '@/utils/FileType'
import { getImageDimensions } from '@/utils/ImageUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ImageUploadBody')

/** 探测图片尺寸的大小上限，超过则按 0x0 发送，避免为量尺寸把超大文件读进内存 */
const MAX_DIMENSION_PROBE_SIZE = 20 * 1024 * 1024

/**
 * 判断附件是否应以图片消息（m.image）发送。
 *
 * 只分流图片：视频/音频仍按文件发送，避免引入未验证的缩略图/时长字段。
 * svg 不作为图片消息（与 `getMessageTypeByFile` 的排除逻辑保持一致）。
 */
export function isImageUpload(file: UploadFile): boolean {
  if (getFileExtension(file.name) === 'svg') return false
  if (file.type?.startsWith('image/')) return true
  return (SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(getFileExtension(file.name))
}

/**
 * 读取图片宽高。读取失败时返回 0x0：
 * Matrix 允许 info.w/h 为 0，接收端会退回原始尺寸渲染，不能因为量不到尺寸就发不出去。
 */
async function resolveImageSize(file: UploadFile): Promise<{ width: number; height: number }> {
  if (file.size > MAX_DIMENSION_PROBE_SIZE) return { width: 0, height: 0 }
  try {
    const imageFile = isPathUploadFile(file)
      ? new File([await readFile(file.path)], file.name, {
          type: file.type || getImageMimeType(file.name)
        })
      : file
    const { width, height } = await getImageDimensions(imageFile)
    return { width, height }
  } catch (error) {
    logger.warn('读取图片尺寸失败，按 0x0 发送:', error)
    return { width: 0, height: 0 }
  }
}

/** 让文件上传链产出的消息体满足 m.image 的字段要求。 */
export async function withImageInfo(
  messageBody: Record<string, unknown>,
  file: UploadFile
): Promise<Record<string, unknown>> {
  const { width, height } = await resolveImageSize(file)
  return {
    ...messageBody,
    fileName: (messageBody.fileName as string | undefined) || file.name,
    mimetype: (messageBody.mimeType as string | undefined) || file.type || getImageMimeType(file.name),
    width,
    height
  }
}
