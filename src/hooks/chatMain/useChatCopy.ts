import { writeImage, writeText } from '@tauri-apps/plugin-clipboard-manager'
import { detectImageFormat, imageUrlToUint8Array, isImageUrl } from '@/utils/ImageUtils'
import { removeTag } from '@/utils/Formatting'
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
        window.$message?.warning('没有可复制的内容')
        return
      }

      if (isImageUrl(textToCopy)) {
        try {
          const imageFormat = detectImageFormat(textToCopy)
          if (imageFormat === 'GIF' || imageFormat === 'WEBP') {
            window.$message?.info(`正在将 ${imageFormat} 格式图片转换为 PNG 并复制...`)
          }
          const imageBytes = await imageUrlToUint8Array(textToCopy)
          await writeImage(imageBytes)
          const successMessage = imageFormat === 'PNG' ? '图片已复制到剪贴板' : '图片已转换为 PNG 格式并复制到剪贴板'
          window.$message?.success(successMessage)
        } catch (imageError) {
          logger.error('图片复制失败:', imageError)
        }
        return
      }

      await writeText(removeTag(textToCopy))
      window.$message?.success(isSelectedText ? '选中文本已复制' : '消息内容已复制')
    } catch (error) {
      logger.error('复制失败:', error)
    }
  }

  return { handleCopy }
}
