import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useCommon } from '@/composables/common/useCommon'
import { useMitt } from '@/composables/common/useMitt'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { MittEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { hasTauriRuntime } from '@/utils/AppHarness'
import type { UploadFile } from '@/utils/FileType'
import { createLogger } from '@/utils/Logger'

interface Options {
  messageInputDom: Ref<HTMLElement | undefined>
  sendFilesDirect: (files: UploadFile[]) => Promise<unknown>
}

/**
 * 输入区的文件入口：粘贴、全局拖拽、截图回调、文件选择弹窗与发送。
 */
export const useMsgInputUploadEntry = ({ messageInputDom, sendFilesDirect }: Options) => {
  const logger = createLogger('MsgInput')
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const { handlePaste, processFiles } = useCommon()
  // Tauri 监听器统一走 useTauriListener（onUnmounted 自动 unlisten）
  const { addListener } = useTauriListener()
  const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null

  const showFileModal = ref(false)
  const pendingFiles = ref<UploadFile[]>([])

  const showFileModalCallback = (files: UploadFile[]) => {
    pendingFiles.value = files
    showFileModal.value = true
  }

  const handleFileUploadClick = () => {
    showFileModalCallback([])
  }

  const onPaste = async (e: ClipboardEvent) => {
    if (messageInputDom.value) await handlePaste(e, messageInputDom.value, showFileModalCallback)
  }

  const handleFileConfirm = async (files: UploadFile[]) => {
    try {
      await sendFilesDirect(files)
    } catch (error) {
      logger.error('Failed to send files from modal:', error)
    }
    showFileModal.value = false
    pendingFiles.value = []
  }

  const handleFileCancel = () => {
    showFileModal.value = false
    pendingFiles.value = []
  }

  const handleGlobalFilesDrop = async (files: UploadFile[]) => {
    if (!files?.length || !messageInputDom.value) return
    try {
      await processFiles(files, messageInputDom.value, showFileModalCallback)
    } catch (error) {
      logger.error('Failed to process dropped files:', error)
      showFeedback(t('message.file.toast.drop_failed'), 'error')
    }
  }

  let removeGlobalFilesDrop: (() => void) | undefined

  onMounted(() => {
    removeGlobalFilesDrop = useMitt.on(MittEnum.GLOBAL_FILES_DROP, handleGlobalFilesDrop)
    if (appWindow) {
      addListener(
        appWindow.listen<{ buffer: number[]; mimeType: string }>('screenshot', async (e) => {
          if (messageInputDom.value) {
            messageInputDom.value.focus()
            try {
              const buffer = new Uint8Array(e.payload.buffer)
              const blob = new Blob([buffer], { type: e.payload.mimeType })
              const file = new File([blob], 'screenshot.png', { type: e.payload.mimeType })
              await processFiles([file], messageInputDom.value, showFileModalCallback)
            } catch (error) {
              logger.error('Failed to process screenshot:', error)
            }
          }
        }),
        'msg-input-screenshot'
      )
    }
  })

  onUnmounted(() => {
    removeGlobalFilesDrop?.()
  })

  return {
    showFileModal,
    pendingFiles,
    showFileModalCallback,
    handleFileUploadClick,
    handleGlobalFilesDrop,
    onPaste,
    handleFileConfirm,
    handleFileCancel
  }
}
