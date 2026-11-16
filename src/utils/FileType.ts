import { MsgEnum } from '@/enums'

/**
 * 上传文件类型（支持浏览器 File 与 Tauri 路径文件）
 */
export type PathUploadFile = {
  kind: 'path'
  path: string
  name: string
  size: number
  type: string
}

export type UploadFile = File | PathUploadFile

/**
 * 判断文件是否为 PathUploadFile
 */
export const isPathUploadFile = (file: UploadFile): file is PathUploadFile => {
  return typeof file === 'object' && (file as PathUploadFile).kind === 'path'
}

/**
 * 支持的视频扩展名（统一定义）
 */
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'wmv', 'mkv', 'flv', 'webm', 'm4v'] as const

/**
 * 支持的音频扩展名
 */
const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] as const

/**
 * 支持的图片扩展名
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] as const

/**
 * 视频MIME类型映射
 */
const VIDEO_MIME_TYPE_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  mkv: 'video/x-matroska',
  flv: 'video/x-flv',
  webm: 'video/webm',
  m4v: 'video/mp4'
} as const

/**
 * 音频MIME类型映射
 */
const AUDIO_MIME_TYPE_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac'
} as const

/**
 * 图片MIME类型映射
 */
const IMAGE_MIME_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
} as const

/**
 * 文档与压缩包MIME类型映射
 */
const DOCUMENT_MIME_TYPE_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed'
} as const

/**
 * 从文件名获取扩展名
 * @param fileName 文件名
 * @returns 小写的扩展名（不含点）
 */
export const getFileExtension = (fileName: string): string => {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * 根据文件扩展名推导MIME类型（图片 / 视频 / 音频 / 文档）
 * @param fileName 文件名
 * @returns 命中的MIME类型；没有扩展名或扩展名未知时返回空字符串，由调用方按场景兜底
 */
export const getMimeTypeByExtension = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  if (!extension) return ''

  return (
    IMAGE_MIME_TYPE_MAP[extension] ||
    VIDEO_MIME_TYPE_MAP[extension] ||
    AUDIO_MIME_TYPE_MAP[extension] ||
    DOCUMENT_MIME_TYPE_MAP[extension] ||
    ''
  )
}

/**
 * 解析上传链路使用的 MIME 类型。
 *
 * 优先级：调用方/File 声明的类型 → 扩展名映射 → 场景兜底。
 * 用于统一「`file.type` 为空时直接退回 application/octet-stream」的散落写法，
 * 避免服务端把 pdf / mp4 等可识别文件落成通用二进制类型。
 *
 * @param declared 调用方或 File 声明的 MIME（可为空字符串）
 * @param fileName 文件名，用于扩展名兜底
 * @param fallback 声明与扩展名都未命中时的兜底类型
 * @returns 解析后的 MIME 类型
 */
export const resolveUploadMimeType = (
  declared: string | undefined,
  fileName: string,
  fallback = 'application/octet-stream'
): string => declared || getMimeTypeByExtension(fileName) || fallback

/** 嗅探文件头时读取的最大字节数（覆盖 ftyp / RIFF 等需要读到第 12 字节的签名） */
const MIME_SNIFF_BYTES = 16

/** ISO BMFF `ftyp` 中可判定为 mp4 的常见品牌；未列入的品牌不猜，交给调用方兜底 */
const FTYP_MP4_BRANDS = new Set(['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'mmp4'])
/** HEIF 家族品牌（iPhone 照片默认格式），避免被误判成视频 */
const FTYP_HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'])
/** AVIF 品牌 */
const FTYP_AVIF_BRANDS = new Set(['avif', 'avis'])

/** 判断字节序列是否以给定签名开头 */
const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte)

/** 读取指定区间的 ASCII 标记（越界时返回空串，不会 throw） */
const asciiAt = (bytes: Uint8Array, start: number, length: number): string => {
  if (bytes.length < start + length) return ''
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

/**
 * 根据文件头（magic number）推断 MIME 类型。
 *
 * 只覆盖上传链路常见格式；签名未命中时返回空串，由调用方继续兜底。
 * `ftyp` 品牌只认白名单（mp4 / quicktime / heic / avif），未知品牌不猜，
 * 避免把 HEIC 等容器误标成 `video/mp4`。
 * 注意：zip 容器（docx / xlsx / apk）在此统一识别为 `application/zip`，
 * 精确子类型需要解析容器目录，超出本函数职责。
 *
 * @param bytes 文件起始字节（建议至少 {@link MIME_SNIFF_BYTES} 字节）
 * @returns 命中的 MIME 类型；未命中返回空串
 */
export const sniffMimeTypeByBytes = (bytes: Uint8Array): string => {
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (asciiAt(bytes, 0, 4) === 'GIF8') return 'image/gif'
  if (asciiAt(bytes, 0, 4) === 'RIFF') {
    const riffFormat = asciiAt(bytes, 8, 4)
    if (riffFormat === 'WEBP') return 'image/webp'
    if (riffFormat === 'WAVE') return 'audio/wav'
  }
  if (asciiAt(bytes, 0, 4) === '%PDF') return 'application/pdf'
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip'
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4)
    if (brand === 'qt  ') return 'video/quicktime'
    if (FTYP_MP4_BRANDS.has(brand)) return 'video/mp4'
    if (FTYP_HEIF_BRANDS.has(brand)) return 'image/heic'
    if (FTYP_AVIF_BRANDS.has(brand)) return 'image/avif'
    return ''
  }
  if (asciiAt(bytes, 0, 4) === 'OggS') return 'application/ogg'
  if (asciiAt(bytes, 0, 4) === 'fLaC') return 'audio/flac'
  if (asciiAt(bytes, 0, 3) === 'ID3') return 'audio/mpeg'
  if (startsWithBytes(bytes, [0xff, 0xfb]) || startsWithBytes(bytes, [0xff, 0xf3])) return 'audio/mpeg'
  return ''
}

/**
 * 上传链路 MIME 解析（带文件头兜底）。
 *
 * 与 {@link resolveUploadMimeType} 的差别只有一处：当声明类型缺失（或为通用
 * `application/octet-stream`）且扩展名无法判定时，再读一次文件头嗅探，
 * 避免无扩展名文件（截图、第三方转存、`blob` 命名）被落成通用二进制。
 * 声明类型与扩展名都可用时不会读取字节，零额外 IO。
 *
 * @param file 待上传的文件或 Blob
 * @param fileName 文件名，用于扩展名兜底
 * @param fallback 三者都未命中时的兜底类型
 * @returns 解析后的 MIME 类型
 */
export const resolveUploadMimeTypeFromFile = async (
  file: Blob,
  fileName: string,
  fallback = 'application/octet-stream'
): Promise<string> => {
  const declared = file.type && file.type !== 'application/octet-stream' ? file.type : ''
  const resolved = resolveUploadMimeType(declared, fileName, '')
  if (resolved) return resolved

  try {
    const head = new Uint8Array(await file.slice(0, MIME_SNIFF_BYTES).arrayBuffer())
    return sniffMimeTypeByBytes(head) || fallback
  } catch {
    return fallback
  }
}

/**
 * 通用文件类型检查函数
 * @param fileOrName File对象或文件名
 * @param supportedExtensions 支持的扩展名数组
 * @param mimeTypePrefix MIME类型前缀（如 'video/', 'audio/', 'image/'）
 * @returns 是否为指定类型的文件
 */
const checkFileType = (
  fileOrName: File | string,
  supportedExtensions: readonly string[],
  mimeTypePrefix: string
): boolean => {
  if (typeof fileOrName === 'string') {
    // 如果是字符串，检查扩展名
    const extension = getFileExtension(fileOrName)
    return (supportedExtensions as readonly string[]).includes(extension)
  }

  // 如果是File对象，先检查MIME类型，再检查扩展名
  const file = fileOrName as File
  const extension = getFileExtension(file.name)
  // 特殊处理：.ts文件可能被错误地设置为video/mp2t MIME类型（MPEG Transport Stream）
  if (extension === 'ts' && mimeTypePrefix === 'video/') {
    return false
  }

  // 优先检查MIME类型
  if (file.type?.startsWith(mimeTypePrefix)) {
    return true
  }

  // 如果MIME类型为空或不明确，检查文件扩展名
  return (supportedExtensions as readonly string[]).includes(extension)
}

/**
 * 根据文件扩展名获取视频MIME类型
 * @param fileName 文件名
 * @returns 视频MIME类型
 */
export const getVideoMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return VIDEO_MIME_TYPE_MAP[extension] || 'video/mp4' // 默认返回mp4类型
}

/**
 * 根据文件扩展名获取音频MIME类型
 * @param fileName 文件名
 * @returns 音频MIME类型
 */
export const getAudioMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return AUDIO_MIME_TYPE_MAP[extension] || 'audio/mpeg' // 默认返回mp3类型
}

/**
 * 根据文件扩展名获取图片MIME类型
 * @param fileName 文件名
 * @returns 图片MIME类型
 */
export const getImageMimeType = (fileName: string): string => {
  const extension = getFileExtension(fileName)
  return IMAGE_MIME_TYPE_MAP[extension] || 'image/jpeg' // 默认返回jpeg类型
}

/**
 * 修复文件的MIME类型（如果MIME类型为空或不正确）
 * @param file 原始文件
 * @returns 修复MIME类型后的文件
 */
export const fixFileMimeType = (file: File): File => {
  // 如果已经有正确的MIME类型，直接返回
  if (
    file.type &&
    (file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type.startsWith('image/'))
  ) {
    return file
  }

  const extension = getFileExtension(file.name)
  let correctMimeType = ''

  // 根据扩展名确定正确的MIME类型
  if ((SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    correctMimeType = getVideoMimeType(file.name)
  } else if ((SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(extension)) {
    correctMimeType = getAudioMimeType(file.name)
  } else if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    correctMimeType = getImageMimeType(file.name)
  } else {
    // 如果不是媒体文件，保持原有类型
    return file
  }

  // 创建新的File对象，修复MIME类型
  return new File([file], file.name, {
    type: correctMimeType,
    lastModified: file.lastModified
  })
}

/**
 * 根据文件类型获取对应的消息枚举
 * @param file File对象
 * @returns 消息类型枚举
 */
export const getMessageTypeByFile = (file: File): MsgEnum => {
  if (checkFileType(file, SUPPORTED_VIDEO_EXTENSIONS, 'video/')) {
    return MsgEnum.VIDEO
  } else if (checkFileType(file, SUPPORTED_AUDIO_EXTENSIONS, 'audio/')) {
    return MsgEnum.VOICE
  } else if (checkFileType(file, SUPPORTED_IMAGE_EXTENSIONS, 'image/') && !file.type.includes('svg')) {
    return MsgEnum.IMAGE
  } else {
    return MsgEnum.FILE
  }
}

/**
 * 检查URL是否为视频链接
 * @param url 链接地址
 * @returns 是否为视频链接
 */
export const isVideoUrl = (url: string): boolean => {
  try {
    new URL(url)
    return checkFileType(url, SUPPORTED_VIDEO_EXTENSIONS, 'video/')
  } catch {
    return false
  }
}
