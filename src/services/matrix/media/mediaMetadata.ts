/**
 * Media 服务 — 元数据提取模块。
 *
 * 从 MatrixMediaService 抽离，包含图片/视频/音频的维度、时长提取逻辑。
 * 纯 DOM 函数，不依赖 Matrix 服务。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('MediaMetadata')

/** 带超时的 Promise 包装 */
export function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(errorMessage)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}

/** 获取图片宽高（10s 超时，失败返回 0x0） */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return withTimeout(
    new Promise<{ width: number; height: number }>((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const result = { width: img.naturalWidth, height: img.naturalHeight }
        URL.revokeObjectURL(url)
        resolve(result)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        logger.warn(`[MatrixMedia][AVATAR_DEBUG] getImageDimensions onerror, 用默认尺寸 0x0`)
        resolve({ width: 0, height: 0 })
      }
      img.src = url
    }),
    10000,
    '获取图片尺寸超时'
  ).catch((err) => {
    logger.warn(`[MatrixMedia][AVATAR_DEBUG] getImageDimensions 失败, 用默认尺寸: ${err}`)
    return { width: 0, height: 0 }
  })
}

/** 获取视频元数据（宽/高/时长 ms，10s 超时） */
export function getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration * 1000)
        })
        URL.revokeObjectURL(video.src)
      }
      video.onerror = () => {
        reject(new Error('无法加载视频'))
        URL.revokeObjectURL(video.src)
      }
      video.src = URL.createObjectURL(file)
    }),
    10000,
    '获取视频元数据超时'
  )
}

/** 获取音频时长（ms，10s 超时） */
export function getAudioDuration(file: File): Promise<number> {
  return withTimeout(
    new Promise((resolve, reject) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        resolve(Math.round(audio.duration * 1000))
        URL.revokeObjectURL(audio.src)
      }
      audio.onerror = () => {
        reject(new Error('无法加载音频'))
        URL.revokeObjectURL(audio.src)
      }
      audio.src = URL.createObjectURL(file)
    }),
    10000,
    '获取音频时长超时'
  )
}
