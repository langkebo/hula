/**
 * Matrix SDK 类型包装层
 *
 * 提供稳定的内部类型，隔离 SDK 版本变化带来的影响
 */

import { isObject } from './typeGuard'

// ==================== 消息内容类型 ====================

/**
 * 通用消息内容
 */
export interface MatrixContent {
  msgtype: string
  body: string
  [key: string]: unknown
}

/**
 * 文本消息内容
 */
export interface TextContent extends MatrixContent {
  msgtype: 'm.text'
  body: string
  'm.relates_to'?: {
    'm.in_reply_to'?: {
      event_id: string
    }
  }
}

/**
 * 图片消息内容
 */
export interface ImageContent extends MatrixContent {
  msgtype: 'm.image'
  url: string
  info?: {
    w?: number
    h?: number
    size?: number
    mimetype?: string
  }
}

/**
 * 视频消息内容
 */
export interface VideoContent extends MatrixContent {
  msgtype: 'm.video'
  url: string
  info?: {
    w?: number
    h?: number
    size?: number
    duration?: number
    mimetype?: string
    thumbnail_url?: string
    thumbnail_info?: {
      w?: number
      h?: number
      size?: number
    }
  }
}

/**
 * 音频消息内容
 */
export interface AudioContent extends MatrixContent {
  msgtype: 'm.audio'
  url: string
  info?: {
    size?: number
    duration?: number
    mimetype?: string
  }
}

/**
 * 文件消息内容
 */
export interface FileContent extends MatrixContent {
  msgtype: 'm.file'
  url: string
  filename?: string
  info?: {
    size?: number
    mimetype?: string
  }
}

/**
 * 位置消息内容
 */
export interface LocationContent {
  msgtype: 'm.location'
  body?: string
  geo_uri: string
  [key: string]: unknown
}

// ==================== 类型 Guards ====================

/**
 * 检查是否为文本内容
 */
export function isTextContent(content: unknown): content is TextContent {
  return isObject(content) && content.msgtype === 'm.text'
}

/**
 * 检查是否为图片内容
 */
export function isImageContent(content: unknown): content is ImageContent {
  return isObject(content) && content.msgtype === 'm.image'
}

/**
 * 检查是否为视频内容
 */
export function isVideoContent(content: unknown): content is VideoContent {
  return isObject(content) && content.msgtype === 'm.video'
}

/**
 * 检查是否为音频内容
 */
export function isAudioContent(content: unknown): content is AudioContent {
  return isObject(content) && content.msgtype === 'm.audio'
}

/**
 * 检查是否为文件内容
 */
export function isFileContent(content: unknown): content is FileContent {
  return isObject(content) && content.msgtype === 'm.file'
}

/**
 * 检查是否为位置内容
 */
export function isLocationContent(content: unknown): content is LocationContent {
  return isObject(content) && content.msgtype === 'm.location'
}

// ==================== 内容构建器 ====================

/**
 * 创建文本消息内容
 */
export function createTextContent(body: string, replyTo?: string): TextContent {
  const content: TextContent = {
    msgtype: 'm.text',
    body
  }
  if (replyTo) {
    content['m.relates_to'] = {
      'm.in_reply_to': {
        event_id: replyTo
      }
    }
  }
  return content
}

/**
 * 创建图片消息内容
 */
export function createImageContent(url: string, fileName: string, info?: ImageContent['info']): ImageContent {
  return {
    msgtype: 'm.image',
    body: fileName,
    url,
    info
  }
}

/**
 * 创建视频消息内容
 */
export function createVideoContent(url: string, fileName: string, info?: VideoContent['info']): VideoContent {
  return {
    msgtype: 'm.video',
    body: fileName,
    url,
    info
  }
}

/**
 * 创建音频消息内容
 */
export function createAudioContent(url: string, info?: AudioContent['info']): AudioContent {
  return {
    msgtype: 'm.audio',
    body: 'audio',
    url,
    info
  }
}

/**
 * 创建文件消息内容
 */
export function createFileContent(url: string, fileName: string, info?: FileContent['info']): FileContent {
  return {
    msgtype: 'm.file',
    body: fileName,
    filename: fileName,
    url,
    info
  }
}

/**
 * 创建位置消息内容
 */
export function createLocationContent(geoUri: string, description?: string): LocationContent {
  return {
    msgtype: 'm.location',
    body: description || 'location',
    geo_uri: geoUri
  }
}

// ==================== SDK 调用包装 ====================

/**
 * Matrix 事件内容类型
 */
export type EventContent = TextContent | ImageContent | VideoContent | AudioContent | FileContent | LocationContent

/**
 * 安全的 SDK 事件发送
 * 返回 unknown 以兼容不同 SDK 版本
 */
export function toSdkContent(content: EventContent): unknown {
  return content as unknown
}
