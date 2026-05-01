import { MsgEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'

type RoomPreviewKey =
  | 'media.image'
  | 'media.video'
  | 'media.audio'
  | 'media.file'
  | 'media.message'
  | 'membership.join'
  | 'membership.leave'
  | 'media.voice'
  | 'media.emoji'
  | 'media.notice'
  | 'media.merge'
  | 'media.video_call'
  | 'media.audio_call'
  | 'media.location'
  | 'media.beacon'
  | 'media.link_preview'

const ROOM_PREVIEW_FALLBACKS: Record<RoomPreviewKey, string> = {
  'media.image': '[图片]',
  'media.video': '[视频]',
  'media.audio': '[音频]',
  'media.voice': '[语音]',
  'media.file': '[文件]',
  'media.emoji': '[表情]',
  'media.notice': '[通知]',
  'media.merge': '[聊天记录]',
  'media.video_call': '[视频通话]',
  'media.audio_call': '[语音通话]',
  'media.location': '[位置]',
  'media.beacon': '[实时位置共享]',
  'media.link_preview': '[链接预览]',
  'media.message': '[消息]',
  'membership.join': '加入了房间',
  'membership.leave': '离开了房间'
}

// 缓存计算结果，避免在虚拟列表中频繁重算
const previewCache = new Map<string, string>()

function translateRoomPreview(key: RoomPreviewKey) {
  const fullKey = `room_preview.${key}`
  try {
    const translated = String(useI18nGlobal()?.t?.(fullKey) ?? fullKey)
    return translated === fullKey ? ROOM_PREVIEW_FALLBACKS[key] : translated
  } catch {
    return ROOM_PREVIEW_FALLBACKS[key]
  }
}

/**
 * 获取时间线事件预览文字
 */
export function getRoomTimelinePreview(eventType: string, content: Record<string, unknown>): string | null {
  const cacheKey = `timeline:${eventType}:${JSON.stringify(content)}`
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey)!

  let result: string | null = null
  const msgType = typeof content.msgtype === 'string' ? content.msgtype : undefined

  if (msgType === 'm.text' || msgType === 'm.notice') {
    result = typeof content.body === 'string' ? content.body : null
  } else if (msgType === 'm.image') {
    result = translateRoomPreview('media.image')
  } else if (msgType === 'm.video') {
    result = translateRoomPreview('media.video')
  } else if (msgType === 'm.audio' || msgType === 'm.voice') {
    result = translateRoomPreview('media.audio')
  } else if (msgType === 'm.file') {
    result = translateRoomPreview('media.file')
  } else if (eventType === 'm.room.member') {
    result =
      content.membership === 'join' ? translateRoomPreview('membership.join') : translateRoomPreview('membership.leave')
  } else {
    result = typeof content.body === 'string' ? content.body : null
  }

  if (result) previewCache.set(cacheKey, result)
  return result
}

/**
 * 获取消息预览文字
 */
export function getMessagePreviewByType(type: MsgEnum, body: Record<string, unknown>): string {
  const cacheKey = `msg:${type}:${JSON.stringify(body)}`
  if (previewCache.has(cacheKey)) return previewCache.get(cacheKey)!

  let result = ''
  switch (type) {
    case MsgEnum.IMAGE:
      result = translateRoomPreview('media.image')
      break
    case MsgEnum.VIDEO:
      result = translateRoomPreview('media.video')
      break
    case MsgEnum.VOICE:
      result = translateRoomPreview('media.voice')
      break
    case MsgEnum.FILE:
      result = translateRoomPreview('media.file')
      break
    case MsgEnum.EMOJI:
      result = translateRoomPreview('media.emoji')
      break
    case MsgEnum.NOTICE:
      result = translateRoomPreview('media.notice')
      break
    case MsgEnum.MERGE:
      result = translateRoomPreview('media.merge')
      break
    case MsgEnum.VIDEO_CALL:
      result = translateRoomPreview('media.video_call')
      break
    case MsgEnum.AUDIO_CALL:
      result = translateRoomPreview('media.audio_call')
      break
    case MsgEnum.LOCATION:
      result = translateRoomPreview('media.location')
      break
    case MsgEnum.BEACON:
      result = translateRoomPreview('media.beacon')
      break
    case MsgEnum.LINK_PREVIEW:
      result = translateRoomPreview('media.link_preview')
      break
    case MsgEnum.SYSTEM:
      result =
        body.membership === 'join' ? translateRoomPreview('membership.join') : translateRoomPreview('membership.leave')
      break
    case MsgEnum.TEXT:
      result = (body.content ?? body.body ?? '') as string
      break
    default:
      result = translateRoomPreview('media.message')
  }

  previewCache.set(cacheKey, result)
  return result
}
