import { appDataDir, join } from '@tauri-apps/api/path'
import { readDir } from '@tauri-apps/plugin-fs'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocalAlbumScanner')

/** 扫描出的单个媒体文件（由调用方写入自己的 store） */
export interface ScannedAlbumFile {
  id: string
  roomId: string
  fileName: string
  type: 'image' | 'video'
  url: string
  suffix: string
  mimeType: string
}

export interface LocalAlbumScanDeps {
  /** 当前用户房间目录（相对 AppData），由 user store 提供 */
  getUserRoomDir: () => Promise<string>
  /** 写入目标 store；扫描器不持有 store，避免移动端实现反向依赖状态层 */
  addFile: (file: ScannedAlbumFile) => void
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm']

/** 按扩展名判定媒体类型；非媒体返回 null */
export function resolveAlbumMediaType(ext: string): 'image' | 'video' | null {
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  return null
}

/**
 * 扫描移动端 AppData 下的房间目录，把图片/视频写回调用方的 store。
 *
 * 这个模块**只属于移动端**：它依赖 Tauri 的 `appDataDir` / `readDir`，桌面端不调用。
 * 原先这段逻辑放在 `stores/domains/widget/file.ts` 里，用平台判断在运行时挡桌面 —
 * 但唯一调用方是 `views/my/MyAlbum.vue`（移动端页面），那道判断永远为真，
 * 属「用运行时分支冒充平台边界」。按 §19.13 的收敛策略下沉到 `src/mobile/` 后，
 * store 侧不再需要知道平台。
 *
 * @returns 新增的媒体文件数；目录不可读等错误一律吞掉返回 0（不该因为相册扫描失败阻断页面）
 */
export async function scanLocalAlbum(roomId: string, deps: LocalAlbumScanDeps): Promise<number> {
  if (!roomId) return 0

  try {
    const userRoomDir = await deps.getUserRoomDir()
    const absolutePath = await join(await appDataDir(), userRoomDir)
    const entries = await readDir(absolutePath)

    let addedCount = 0

    for (const entry of entries) {
      if (!entry.isFile) continue

      const fileName = entry.name
      const dotIndex = fileName.lastIndexOf('.')
      if (dotIndex <= 0) continue

      const ext = fileName.slice(dotIndex).toLowerCase()
      const type = resolveAlbumMediaType(ext)
      if (!type) continue

      // 没有原始消息 ID 可用，退化为文件名（不含扩展名）
      const fileId = fileName.slice(0, dotIndex)
      // 相对路径：与 getUserRoomDir 返回的格式保持一致，供 convertFileSrc 解析
      const fileUrl = await join(userRoomDir, fileName)

      deps.addFile({
        id: fileId,
        roomId,
        fileName,
        type,
        url: fileUrl,
        suffix: ext.slice(1),
        mimeType: `${type}/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}`
      })
      addedCount += 1
    }

    return addedCount
  } catch (error) {
    logger.error('扫描本地相册失败:', error)
    return 0
  }
}
