import DOMPurify from 'dompurify'
import { compact } from 'es-toolkit'
import { padZero } from '@/utils/StringUtils'

/**
 * 文件大小格式化
 */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0 || isNaN(bytes)) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const base = 1024
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base))
  const size = parseFloat((bytes / base ** unitIndex).toFixed(2))

  return size + ' ' + units[unitIndex]
}

/** 时长格式化选项 */
export interface FormatDurationOptions {
  /** 是否对秒数四舍五入（默认 false，向下取整） */
  round?: boolean
  /** 是否将分钟补零到两位（默认 false） */
  padMinutes?: boolean
}

/**
 * 秒数格式化（秒 -> m:ss）
 * 统一语音消息时长、媒体时长等重复实现。
 * @param seconds 秒数
 * @param options round: 四舍五入秒数；padMinutes: 分钟补零到两位
 */
export const formatDuration = (seconds: number, options: FormatDurationOptions = {}): string => {
  const { round = false, padMinutes = false } = options
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const total = round ? Math.round(safeSeconds) : Math.floor(safeSeconds)
  const minutes = Math.floor(total / 60)
  const remainingSeconds = total % 60
  const minutesText = padMinutes ? padZero(minutes) : minutes.toString()
  return `${minutesText}:${padZero(remainingSeconds)}`
}

/** 文件图标映射关系表 */
const fileSuffixMap: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'jpg',
  webp: 'jpg',
  mp4: 'mp4',
  mov: 'mp4',
  avi: 'mp4',
  rmvb: 'mp4',
  doc: 'doc',
  docx: 'doc',
  mp3: 'mp3',
  wav: 'mp3',
  aac: 'mp3',
  flac: 'mp3',
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'ppt',
  xls: 'xls',
  xlsx: 'xls',
  zip: 'zip',
  rar: 'zip',
  '7z': 'zip',
  txt: 'txt',
  log: 'log',
  svg: 'svg',
  sketch: 'sketch',
  exe: 'exe',
  md: 'md',
  ts: 'ts'
}
/**
 * 获取文件对应的Icon
 * @param fileName 文件名
 * @returns Icon
 */
export const getFileSuffix = (fileName: string): string => {
  if (!fileName) return 'other'

  const suffix = fileName.toLowerCase().split('.').pop()
  if (!suffix) return 'other'

  return fileSuffixMap[suffix] || 'other'
}

/**
 * 从文件路径中提取文件名
 * @param path 文件路径
 * @returns 文件名
 */
export const extractFileName = (path: string): string => {
  // 同时处理 Unix 和 Windows 路径分隔符
  const fileName = path.split(/[/\\]/).pop()
  return fileName || 'file'
}

/**
 * 根据文件扩展名获取MIME类型
 * @param fileName 文件名
 * @returns MIME类型
 */
export const getMimeTypeFromExtension = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml'
  }
  return mimeMap[ext] || 'image/png'
}

/**
 * @param fragment 字符串
 * @returns 去除元素标记后的字符串
 * */
export const removeTag = (fragment: string) => {
  const sanitizedFragment = DOMPurify.sanitize(fragment)
  const normalizedFragment = sanitizedFragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|blockquote|h[1-6])>/gi, '')
    .replace(/<(div|p|li|tr|td|blockquote|h[1-6])[^>]*>/gi, '\n')
    .replace(/\r\n|\r/g, '\n')

  const textContent = new DOMParser().parseFromString(normalizedFragment, 'text/html').body.textContent || fragment

  return textContent.replace(/\u00A0/g, ' ')
}

/**
 * 非中文文本超过指定非空格字符数时截断并追加省略号
 */
export const formatBottomText = (text: string, maxLength = 6, omission = '...') => {
  const pureText = text.replace(/\s/g, '')
  const hasChinese = /[\u4e00-\u9fa5]/.test(pureText)
  if (hasChinese || pureText.length <= maxLength) {
    return text
  }

  const nonSpaceIndexes = compact(Array.from(text).map((char, idx) => (char.trim().length > 0 ? idx : undefined)))
  const cutIndex = nonSpaceIndexes[maxLength - 1] ?? text.length - 1

  return `${text.slice(0, cutIndex + 1).trimEnd()}${omission}`
}
