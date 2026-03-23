/**
 * 图片压缩工具
 *
 * 使用 Canvas API 压缩图片，支持质量控制和尺寸限制
 */

export interface CompressOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  maxSizeKB?: number
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface CompressResult {
  blob: Blob
  base64: string
  width: number
  height: number
  originalSize: number
  compressedSize: number
  compressionRatio: number
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeKB: 1024,
  mimeType: 'image/jpeg'
}

export async function compressImage(
  file: File | Blob | string,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const img = await loadImage(file)

  const originalSize = file instanceof File ? file.size : 0

  const { width, height } = calculateDimensions(img.width, img.height, opts.maxWidth, opts.maxHeight)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法获取 Canvas 2D 上下文')
  }

  ctx.drawImage(img, 0, 0, width, height)

  let quality = opts.quality
  let blob = await canvasToBlob(canvas, opts.mimeType, quality)

  if (opts.maxSizeKB > 0) {
    let iterations = 0
    const maxIterations = 10

    while (blob.size > opts.maxSizeKB * 1024 && iterations < maxIterations && quality > 0.1) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, opts.mimeType, quality)
      iterations++
    }

    if (blob.size > opts.maxSizeKB * 1024 && width > 400 && height > 400) {
      const scaleFactor = Math.sqrt((opts.maxSizeKB * 1024) / blob.size)
      const newWidth = Math.floor(width * scaleFactor)
      const newHeight = Math.floor(height * scaleFactor)

      canvas.width = newWidth
      canvas.height = newHeight
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      blob = await canvasToBlob(canvas, opts.mimeType, 0.8)
    }
  }

  const base64 = await blobToBase64(blob)

  return {
    blob,
    base64,
    width: canvas.width,
    height: canvas.height,
    originalSize,
    compressedSize: blob.size,
    compressionRatio: originalSize > 0 ? ((originalSize - blob.size) / originalSize) * 100 : 0
  }
}

function loadImage(file: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))

    if (typeof file === 'string') {
      img.src = file
    } else {
      img.src = URL.createObjectURL(file)
      img.onload = () => URL.revokeObjectURL(img.src)
    }
  })
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight)
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas 转换为 Blob 失败'))
        }
      },
      mimeType,
      quality
    )
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const result = await compressImage(file, options)
  const fileName = file.name.replace(/\.[^.]+$/, '.jpg')
  return new File([result.blob], fileName, { type: result.blob.type })
}

export function getImageDimensions(file: File | Blob | string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => reject(new Error('获取图片尺寸失败'))
    img.onload = () => {
      if (typeof file !== 'string') {
        URL.revokeObjectURL(img.src)
      }
    }

    if (typeof file === 'string') {
      img.src = file
    } else {
      img.src = URL.createObjectURL(file)
    }
  })
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
