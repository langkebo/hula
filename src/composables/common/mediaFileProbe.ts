/**
 * 文件元数据探测（图片宽高 / 音频时长）。
 *
 * 预览地址统一交给 {@link TempObjectUrls} 托管，替换与 scope 销毁时自动释放。
 */
import { getImageDimensions } from '@/utils/ImageUtils'
import type { TempObjectUrls } from './useTempObjectUrls'

/**
 * 获取图片宽高，并登记预览 URL 供替换/卸载时统一释放。
 * 失败时返回零尺寸（调用方按「无法解析」处理）。
 */
export const probeImageDimensions = async (file: File, tempUrls: TempObjectUrls) => {
  try {
    const result = await getImageDimensions(file, { includePreviewUrl: true })
    // previewUrl 由调用方负责释放，这里登记以便替换/卸载时统一 revoke
    tempUrls.track(result.previewUrl)
    return {
      width: result.width,
      height: result.height,
      tempUrl: result.previewUrl!
    }
  } catch {
    return { width: 0, height: 0, url: null }
  }
}

/** 获取音频时长，登记临时 URL；解析失败时立即释放并 reject。 */
export const probeAudioDuration = (file: File, tempUrls: TempObjectUrls) => {
  return new Promise<{ second: number; tempUrl: string }>((resolve, reject) => {
    const audio = new Audio()
    const tempUrl = URL.createObjectURL(file)
    // 音频会在播放前被移除，登记后由替换/卸载统一释放
    tempUrls.track(tempUrl)
    audio.src = tempUrl
    // 计算音频的时长
    const countAudioTime = async () => {
      while (isNaN(audio.duration) || audio.duration === Infinity) {
        // 防止浏览器卡死
        await new Promise((r) => setTimeout(r, 100))
        // 随机进度条位置
        audio.currentTime = 100000 * Math.random()
      }
      // 取整
      const second = Math.round(audio.duration || 0)
      resolve({ second, tempUrl })
    }
    countAudioTime()
    audio.onerror = () => {
      // 解析失败时立即释放，避免临时 URL 泄漏
      tempUrls.release(tempUrl)
      reject({ second: 0, tempUrl })
    }
  })
}
