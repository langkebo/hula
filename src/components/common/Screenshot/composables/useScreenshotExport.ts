import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'
import type { ScreenConfig } from '../types'

const logger = createLogger('ScreenshotExport')

interface UseScreenshotExportOptions {
  imgCanvas: Ref<HTMLCanvasElement | null>
  drawCanvas: Ref<HTMLCanvasElement | null>
  screenConfig: Ref<ScreenConfig>
  borderRadius: Ref<number>
  isImageLoaded: Ref<boolean>
  resetScreenshot: () => Promise<void>
}

/**
 * Canvas merge → crop → rounded-corner → blob pipeline
 * for exporting the selected screenshot area.
 */
export const useScreenshotExport = ({
  imgCanvas,
  drawCanvas,
  screenConfig,
  borderRadius,
  isImageLoaded,
  resetScreenshot
}: UseScreenshotExportOptions) => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  /**
   * Merge base + draw canvases, crop to selection, apply rounded corners.
   * Returns the resulting Blob or null on failure.
   */
  const exportSelection = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const { startX, startY, endX, endY } = screenConfig.value
      const width = Math.abs(endX - startX)
      const height = Math.abs(endY - startY)

      if (width < 1 || height < 1) {
        resolve(null)
        return
      }

      const rectX = Math.min(startX, endX)
      const rectY = Math.min(startY, endY)

      const mergedCanvas = document.createElement('canvas')
      const mergedCtx = mergedCanvas.getContext('2d')
      mergedCanvas.width = imgCanvas.value!.width
      mergedCanvas.height = imgCanvas.value!.height

      if (!mergedCtx) {
        resolve(null)
        return
      }

      try {
        mergedCtx.drawImage(imgCanvas.value!, 0, 0)
        mergedCtx.globalCompositeOperation = 'source-over'
        mergedCtx.drawImage(drawCanvas.value!, 0, 0)

        const offscreenCanvas = document.createElement('canvas')
        const offscreenCtx = offscreenCanvas.getContext('2d')
        offscreenCanvas.width = width
        offscreenCanvas.height = height

        if (!offscreenCtx) {
          resolve(null)
          return
        }

        offscreenCtx.drawImage(mergedCanvas, rectX, rectY, width, height, 0, 0, width, height)

        // Apply rounded corners via destination-in composite
        if (borderRadius.value > 0) {
          const scale = screenConfig.value.scaleX || 1
          const r = Math.min(borderRadius.value * scale, width / 2, height / 2)
          if (r > 0) {
            offscreenCtx.save()
            offscreenCtx.globalCompositeOperation = 'destination-in'
            offscreenCtx.beginPath()
            offscreenCtx.moveTo(r, 0)
            offscreenCtx.lineTo(width - r, 0)
            offscreenCtx.quadraticCurveTo(width, 0, width, r)
            offscreenCtx.lineTo(width, height - r)
            offscreenCtx.quadraticCurveTo(width, height, width - r, height)
            offscreenCtx.lineTo(r, height)
            offscreenCtx.quadraticCurveTo(0, height, 0, height - r)
            offscreenCtx.lineTo(0, r)
            offscreenCtx.quadraticCurveTo(0, 0, r, 0)
            offscreenCtx.closePath()
            offscreenCtx.fill()
            offscreenCtx.restore()
          }
        }

        offscreenCanvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), 'image/png')
      } catch (error) {
        logger.error('Canvas operation failed:', error)
        resolve(null)
      }
    })
  }

  /**
   * Full confirm-selection flow: export → emit to home window → clipboard → reset.
   */
  const confirmSelection = async (
    emitTo: (target: string, event: string, payload: unknown) => Promise<void>,
    writeImage: (buffer: Uint8Array) => Promise<void>,
    hideMagnifier: () => void
  ) => {
    hideMagnifier()

    if (!isImageLoaded.value) {
      await resetScreenshot()
      return
    }

    const { startX, startY, endX, endY } = screenConfig.value
    const width = Math.abs(endX - startX)
    const height = Math.abs(endY - startY)

    if (width < 1 || height < 1) {
      await resetScreenshot()
      return
    }

    const blob = await exportSelection()

    if (!blob) {
      showFeedback(t('message.screenshot.save_failed'), 'error')
      await resetScreenshot()
      return
    }

    try {
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      try {
        await emitTo('home', 'screenshot', {
          type: 'image',
          buffer: Array.from(buffer),
          mimeType: 'image/png'
        })
      } catch (e) {
        logger.warn('Failed to send screenshot to home window:', e)
      }

      try {
        await writeImage(buffer)
        showFeedback(t('message.screenshot.save_success'), 'success')
      } catch (clipboardError) {
        logger.error('Failed to copy screenshot to clipboard:', clipboardError)
        showFeedback(t('message.screenshot.save_failed'), 'error')
      }

      await resetScreenshot()
    } catch {
      showFeedback(t('message.screenshot.save_failed'), 'error')
      await resetScreenshot()
    }
  }

  return {
    exportSelection,
    confirmSelection
  }
}
