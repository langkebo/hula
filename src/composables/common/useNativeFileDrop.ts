import type { UnlistenFn } from '@tauri-apps/api/event'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { ref } from 'vue'
import { MittEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import type { FilesMeta } from '@/services/types'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import FileUtil from '@/utils/FileUtil'
import { createLogger } from '@/utils/Logger'
import { getFilesMeta } from '@/utils/PathUtil'
import { useActionFeedback } from './useActionFeedback'
import { useMitt } from './useMitt'

const logger = createLogger('NativeFileDrop')

/**
 * 原生窗口文件拖拽：把系统拖入的文件转换为应用可上传的文件对象，
 * 并广播 `MittEnum.GLOBAL_FILES_DROP` 交由聊天区处理。
 */
export function useNativeFileDrop(appWindow: WebviewWindow | null) {
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const globalStore = useGlobalStore()

  const isDraggingFiles = ref(false)
  const unlisteners: UnlistenFn[] = []

  const cleanupNativeFileDropListeners = () => {
    while (unlisteners.length > 0) {
      const unlisten = unlisteners.pop()
      unlisten?.()
    }
  }

  const buildPathUploadFiles = async (paths: string[]) => {
    if (!paths?.length) return []
    try {
      const filesMeta = (await getFilesMeta<FilesMeta>(paths)) ?? []
      return await FileUtil.copyDroppedFilesToAppScope(paths, filesMeta)
    } catch (error) {
      logger.error('Failed to parse dropped file metadata:', error)
      showFeedback(t('home.file_drop.parse_failed'), 'error')
      return []
    }
  }

  const handleNativeFileDrop = async (paths: string[]) => {
    if (!paths?.length) return
    try {
      const pathFiles = await buildPathUploadFiles(paths)
      if (pathFiles.length > 0) {
        useMitt.emit(MittEnum.GLOBAL_FILES_DROP, pathFiles)
      } else {
        showFeedback(t('home.file_drop.unrecognized'), 'error')
      }
    } catch (error) {
      logger.error('Failed to handle native file drop:', error)
    } finally {
      isDraggingFiles.value = false
    }
  }

  const setupNativeFileDropListeners = async () => {
    if (!hasTauriRuntime() || !appWindow) return
    try {
      const unlisten = await appWindow.onDragDropEvent((event) => {
        // 只有选中会话时才响应拖拽事件
        if (!globalStore.currentSessionRoomId) return

        if (event.payload.type === 'enter') {
          const paths = event.payload.paths || []
          if (paths.length > 0) {
            isDraggingFiles.value = true
          }
        } else if (event.payload.type === 'over') {
          isDraggingFiles.value = true
        } else if (event.payload.type === 'drop') {
          const paths = event.payload.paths || []
          handleNativeFileDrop(paths)
        } else if (event.payload.type === 'leave') {
          isDraggingFiles.value = false
        }
      })
      unlisteners.push(unlisten)
    } catch (error) {
      logger.error('Failed to register native file drop listener:', error)
    }
  }

  return {
    isDraggingFiles,
    setupNativeFileDropListeners,
    cleanupNativeFileDropListeners
  }
}
