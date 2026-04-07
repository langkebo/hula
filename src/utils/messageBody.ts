/**
 * MessageBody 类型 guards 和工具函数
 */

import type { MessageBody } from '@/stores/message'
import { isObject, isString } from './typeGuard'

/**
 * 检查值是否为 MessageBody
 */
export function isMessageBody(val: unknown): val is MessageBody {
  if (!isObject(val)) return false
  const obj = val as Record<string, unknown>
  // 至少有 content 或 body 或 url 之一
  return isString(obj.content) || isString(obj.body) || isString(obj.url) || isObject(obj.reply)
}

/**
 * 将未知 body 转换为安全的 MessageBody
 */
export function toMessageBody(body: unknown): MessageBody {
  if (isMessageBody(body)) {
    return body
  }
  if (isString(body)) {
    return { content: body }
  }
  if (isObject(body)) {
    return body as MessageBody
  }
  return { content: String(body) }
}

/**
 * 安全的 body 类型（用于需要明确类型的场景）
 */
export interface SafeBody {
  content?: string
  body?: string
  url?: string
  text?: string
  fileName?: string
  size?: number
  width?: number
  height?: number
  mimetype?: string
  duration?: number
  filename?: string
  thumbnail?: string
  thumbnailInfo?: { w?: number; h?: number; size?: number }
}

/**
 * 将 body 转换为安全类型
 */
export function toSafeBody(body: unknown): SafeBody {
  const msgBody = toMessageBody(body)
  return {
    content: msgBody.content || '',
    body: msgBody.body || '',
    url: msgBody.url || '',
    text: msgBody.text || '',
    fileName: msgBody.fileName || '',
    size: Number(msgBody.size) || 0,
    width: Number(msgBody.width) || undefined,
    height: Number(msgBody.height) || undefined,
    mimetype: msgBody.mimetype || '',
    duration: Number(msgBody.duration) || 0,
    filename: msgBody.fileName || '',
    thumbnail: String((msgBody as Record<string, unknown>).thumbnail || ''),
    thumbnailInfo: (msgBody as Record<string, unknown>).thumbnailInfo as SafeBody['thumbnailInfo']
  }
}

/**
 * 安全获取 body.content
 */
export function getBodyContent(body: unknown): string {
  const msgBody = toMessageBody(body)
  return msgBody.content || msgBody.body || ''
}

/**
 * 安全获取 body.url
 */
export function getBodyUrl(body: unknown): string {
  const msgBody = toMessageBody(body)
  return msgBody.url || ''
}

/**
 * 安全获取 body.text
 */
export function getBodyText(body: unknown): string {
  const msgBody = toMessageBody(body)
  return msgBody.text || ''
}

/**
 * 安全获取 body.fileName
 */
export function getBodyFileName(body: unknown): string {
  const msgBody = toMessageBody(body)
  return msgBody.fileName || ''
}

/**
 * 安全获取 body.size
 */
export function getBodySize(body: unknown): number {
  const msgBody = toMessageBody(body)
  return msgBody.size || 0
}

/**
 * 安全获取 body.width
 */
export function getBodyWidth(body: unknown): number {
  const msgBody = toMessageBody(body)
  return Number(msgBody.w || msgBody.width || 0)
}

/**
 * 安全获取 body.height
 */
export function getBodyHeight(body: unknown): number {
  const msgBody = toMessageBody(body)
  return Number(msgBody.h || msgBody.height || 0)
}

/**
 * 安全获取 body.mimetype
 */
export function getBodyMimeType(body: unknown): string {
  const msgBody = toMessageBody(body)
  return msgBody.mimetype || ''
}

/**
 * 安全获取 body.reply
 */
export function getBodyReply(body: unknown): MessageBody['reply'] {
  const msgBody = toMessageBody(body)
  return msgBody.reply
}

/**
 * 安全获取 body.translatedText
 */
export function getBodyTranslatedText(
  body: unknown
): { text: string; provider?: string; from?: string; to?: string } | null {
  const msgBody = toMessageBody(body)
  if (isObject(msgBody.translatedText)) {
    return msgBody.translatedText as { text: string; provider?: string }
  }
  return null
}
