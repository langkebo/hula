import { join } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { copyFile, stat } from '@tauri-apps/plugin-fs'
import type { FilesMeta } from '@/services/types'
import type { PathUploadFile } from '@/utils/FileType'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { getFilesMeta } from './PathUtil'

const logger = createLogger('FileUtil')

class FileUtil {
  /**
   * 获取用户资源目录（fallback：动态导入 useUserStore）
   * 当调用方未传入 userResourceDir 时使用
   */
  private static async getUserResourceDir(): Promise<string> {
    const { useUserStore } = await import('../stores/domains/user/user')
    return await useUserStore().getUserRoomAbsoluteDir()
  }
  /**
   * 打开文件选择器，允许用户选择多个文件，将选中的文件复制到用户资源目录下
   * 副作用: 会将选中的文件复制到用户资源目录下
   * @param userResourceDir 可选，用户资源目录路径。未传入时动态获取
   * @returns
   * files: 选中的文件列表
   * filesMeta: 选中的文件元数据列表
   */
  static async openAndCopyFile(userResourceDir?: string): Promise<{
    files: PathUploadFile[]
    filesMeta: FilesMeta
  } | null> {
    // 获取文件路径列表
    const selected = await open({
      multiple: true
      // 不设置filters，允许选择所有文件类型
    })

    if (!selected) {
      return null
    }
    const selectedPaths = Array.isArray(selected) ? selected : [selected]
    const filesMeta = await getFilesMeta<FilesMeta>(selectedPaths)
    void FileUtil.copyUploadFile(selectedPaths, filesMeta, userResourceDir)

    return {
      files: await FileUtil.map2PathUploadFile(selectedPaths, filesMeta),
      filesMeta: filesMeta
    }
  }

  /**
   * 将选中的文件复制到用户资源目录下
   * 副作用: 会将选中的文件复制到用户资源目录下
   * @param files 选中的文件路径列表
   * @param filesMeta 选中的文件元数据列表
   * @param userResourceDir 可选，用户资源目录路径。未传入时动态获取
   * @returns 复制成功的「源路径 → 目标路径」映射（复制失败的文件不包含在内）
   */
  static async copyUploadFile(
    files: string[],
    filesMeta: FilesMeta,
    userResourceDir?: string
  ): Promise<Map<string, string>> {
    const dir = userResourceDir ?? (await FileUtil.getUserResourceDir())
    const copiedPaths = new Map<string, string>()
    for (const filePathStr of files) {
      const fileMeta = filesMeta.find((f) => f.path === filePathStr)
      if (fileMeta) {
        try {
          const destPath = await join(dir, fileMeta.name)
          await copyFile(filePathStr, destPath)
          copiedPaths.set(filePathStr, destPath)
        } catch (error) {
          logger.error('复制文件失败:', error)
        }
      }
    }
    return copiedPaths
  }

  /**
   * 将选中的文件路径列表和文件元数据列表转换为路径文件对象列表
   * @param files 选中的文件路径列表
   * @param filesMeta 选中的文件元数据列表
   * @returns 路径文件对象列表
   */
  static async map2PathUploadFile(files: string[], filesMeta: FilesMeta): Promise<PathUploadFile[]> {
    return await Promise.all(
      files.map(async (path) => {
        const fileMeta = filesMeta.find((f) => f.path === path)
        const fileName = fileMeta?.name || extractFileName(path)
        const fileType = fileMeta?.mime_type || 'application/octet-stream'

        let size = 0
        try {
          size = (await stat(path)).size
        } catch (error) {
          logger.error('获取文件大小失败:', error)
        }

        return {
          kind: 'path',
          path,
          name: fileName,
          size,
          type: fileType
        }
      })
    )
  }

  /**
   * 将拖拽得到的文件复制到用户资源目录（应用作用域），并返回以复制后路径为基础的 PathUploadFile 列表。
   * 供桌面拖拽上传在 readFile / stat 之前调用：fs:read-files 收窄后，拖入 $HOME/$DESKTOP/$PICTURES/$DOCUMENTS
   * 下的文件其原始绝对路径无法被 plugin-fs 读取，需先复制到应用目录再基于复制后的路径做 stat / 上传。
   * 复制失败的文件会被跳过，不进入返回列表。
   * @param files 拖拽得到的源文件绝对路径列表
   * @param filesMeta 拖拽文件元数据列表
   * @param userResourceDir 可选，用户资源目录路径。未传入时动态获取
   * @returns 以应用作用域路径为基础的 PathUploadFile 列表
   */
  static async copyDroppedFilesToResourceDir(
    files: string[],
    filesMeta: FilesMeta,
    userResourceDir?: string
  ): Promise<PathUploadFile[]> {
    const copiedPaths = await FileUtil.copyUploadFile(files, filesMeta, userResourceDir)
    const copiedPathList = files.filter((path) => copiedPaths.has(path)).map((path) => copiedPaths.get(path)!)
    const copiedMeta = filesMeta
      .filter((meta) => copiedPaths.has(meta.path))
      .map((meta) => ({ ...meta, path: copiedPaths.get(meta.path)! }))
    return await FileUtil.map2PathUploadFile(copiedPathList, copiedMeta)
  }
}

export default FileUtil
