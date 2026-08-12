/**
 * Media 服务 — 类型定义模块。
 *
 * 从 MatrixMediaService 抽离，包含上传/下载/元数据相关的接口和常量。
 */

import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'

export interface UploadResult {
  contentUri: string
  size: number
  mimetype: string
}

export interface EncryptedUploadResult extends UploadResult {
  encryptedFile: EncryptedAttachmentFile
}

export interface MediaInfo {
  size: number
  mimetype: string
  width?: number
  height?: number
  duration?: number
}

export interface CompressOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  maxSizeKB?: number
}

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeKB: 1024
}

/** 上传选项（内部用于 MediaManager.uploadContent / http.uploadContent） */
export interface UploadOpts {
  type?: string
  name?: string
  includeFilename?: boolean
  progressHandler?: (progress: { loaded: number; total: number }) => void
}
