import { save } from '@tauri-apps/plugin-dialog'
import { defineStore } from 'pinia'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useDownload } from '@/hooks/useDownload.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DownloadQueueStore')

type DownloadObjType = {
  url: string
  isDownloading: boolean
  process: number | undefined
}

// 保持现有 store 行为，仅修正对外命名。
export const useDownloadQueueStore = defineStore('downloadQueue', () => {
  const { showFeedback } = useActionFeedback()
  const maxDownloadCount = 1
  const queue = reactive<string[]>([])
  const downloadObjMap = reactive<Record<string, DownloadObjType>>({})

  const addQueueAction = (url: string) => {
    queue.push(url)
  }

  const removeQueueAction = (url: string) => {
    const index = queue.indexOf(url)
    if (index > -1) {
      queue.splice(index, 1)
    }
  }

  const dequeue = () => {
    if (!queue.length || Object.keys(downloadObjMap).length >= maxDownloadCount) {
      return
    }
    const url = queue.shift()
    if (url) {
      downloadAction(url)
    }
  }

  const downloadAction = async (url: string) => {
    const { downloadFile, isDownloading, process, onLoaded } = useDownload()

    try {
      const savePath = (await save({
        filters: [
          {
            name: '所有文件',
            extensions: ['*']
          }
        ]
      })) as string

      if (!savePath) {
        removeQueueAction(url)
        return
      }

      const stopWatcher = watch(process, () => {
        downloadObjMap[url] = { url, isDownloading: isDownloading.value, process: process.value }
      })

      onLoaded(() => {
        stopWatcher()
        delete downloadObjMap[url]
        dequeue()
      })

      await downloadFile(url, savePath)
    } catch (error) {
      logger.error('保存失败:', error)
      showFeedback('保存失败', 'error')
      removeQueueAction(url)
    }
  }

  const download = (url: string) => {
    addQueueAction(url)
    dequeue()
  }

  const cancelDownload = (url: string) => {
    if (queue.includes(url)) {
      removeQueueAction(url)
    }
  }

  return {
    queue,
    addQueueAction,
    removeQueueAction,
    dequeue,
    downloadObjMap,
    download,
    cancelDownload
  }
})
