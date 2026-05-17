import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { removeTag } from '@/utils/Formatting'
import { detectImageFormat, imageUrlToUint8Array, isImageUrl } from '@/utils/ImageUtils'
import { createLogger } from '@/utils/Logger'
import { getSelectedText } from './selectionUtils'

const logger = createLogger('ChatMain.Copy')

/**
 * 消息复制工具：文本 / 图片统一入口。
 *
 * 从 useChatMain 抽出。无状态、无 store 依赖，纯函数即可，
 * 保留 composable 形式仅为和调用点的 `useChatCopy()` 习惯一致。
 */
export const useChatCopy = () => {
  const { showFeedback } = useActionFeedback()
  /**
   * @param content 作为回退的消息原文（图片时应传 url）
   * @param prioritizeSelection 优先复制用户选中的文本（默认 true）
   * @param messageId 用于从 selection 中定位当前消息
   */
  const handleCopy = async (
    content: string | undefined,
    prioritizeSelection: boolean = true,
    messageId?: string
  ): Promise<void> => {
    try {
      let textToCopy = content || ''
      let isSelectedText = false

      if (prioritizeSelection) {
        const selectedText = getSelectedText(messageId)
        if (selectedText) {
          textToCopy = selectedText
          isSelectedText = true
        }
      }

      if (!textToCopy) {
        showFeedback('没有可复制的内容', 'warning')
        return
      }

      if (isImageUrl(textToCopy)) {
        try {
          const imageFormat = detectImageFormat(textToCopy)
          if (imageFormat === 'GIF' || imageFormat === 'WEBP') {
            showFeedback(`正在将 ${imageFormat} 格式图片转换为 PNG 并复制...`, 'info')
          }
          const imageBytes = await imageUrlToUint8Array(textToCopy)
          await writeImage(imageBytes)
          const successMessage = imageFormat === 'PNG' ? '图片已复制到剪贴板' : '图片已转换为 PNG 格式并复制到剪贴板'
          showFeedback(successMessage, 'success')
        } catch (imageError) {
          logger.error('图片复制失败:', imageError)
        }
        return
      }

      await writeText(removeTag(textToCopy))
      showFeedback(isSelectedText ? '选中文本已复制' : '消息内容已复制', 'success')
    } catch (error) {
      logger.error('复制失败:', error)
    }
  }

  return { handleCopy }
}
