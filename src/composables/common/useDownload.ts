import { BaseDirectory, exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('Download')

export const useDownload = () => {
  const process = ref(0)
  const isDownloading = ref(false)
  const { on: onLoaded, trigger } = createEventHook()

  const downloadFile = async (
    url: string,
    savePath: string,
    baseDir: BaseDirectory = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
  ) => {
    try {
      isDownloading.value = true
      process.value = 0

      // 确保目录存在
      const dirPath = savePath.substring(0, savePath.lastIndexOf('/'))
      if (dirPath) {
        const dirExists = await exists(dirPath, { baseDir })
        if (!dirExists) {
          await mkdir(dirPath, { baseDir, recursive: true })
        }
      }

      const buffer = await HttpClient.downloadBytes(url)
      await writeFile(savePath, new Uint8Array(buffer), { baseDir })
      process.value = 100
      trigger('success')
    } catch (error) {
      logger.error('下载失败:', error)
      trigger('fail')
      throw error
    } finally {
      isDownloading.value = false
      process.value = 0
    }
  }

  return {
    onLoaded,
    downloadFile,
    process,
    isDownloading
  }
}
