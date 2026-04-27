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

const ROOM_PREVIEW_FALLBACKS: Record<RoomPreviewKey, string> = {
  'media.image': '[图片]',
  'media.video': '[视频]',
  'media.audio': '[音频]',
  'media.file': '[文件]',
  'media.message': '[消息]',
  'membership.join': '加入了房间',
  'membership.leave': '离开了房间'
}

function translateRoomPreview(key: RoomPreviewKey) {
  const fullKey = `room_preview.${key}`
  const translated = String(useI18nGlobal().t(fullKey))
  return translated === fullKey ? ROOM_PREVIEW_FALLBACKS[key] : translated
}

export function getRoomTimelinePreview(eventType: string, content: Record<string, unknown>): string | null {
  const msgType = typeof content.msgtype === 'string' ? content.msgtype : undefined

  if (msgType === 'm.text' || msgType === 'm.notice') {
    return typeof content.body === 'string' ? content.body : null
  }
  if (msgType === 'm.image') return translateRoomPreview('media.image')
  if (msgType === 'm.video') return translateRoomPreview('media.video')
  if (msgType === 'm.audio' || msgType === 'm.voice') return translateRoomPreview('media.audio')
  if (msgType === 'm.file') return translateRoomPreview('media.file')

  if (eventType === 'm.room.member') {
    return content.membership === 'join'
      ? translateRoomPreview('membership.join')
      : translateRoomPreview('membership.leave')
  }

  return typeof content.body === 'string' ? content.body : null
}

export function getMessagePreviewByType(type: MsgEnum, body: Record<string, unknown>): string {
  switch (type) {
    case MsgEnum.IMAGE:
      return translateRoomPreview('media.image')
    case MsgEnum.VIDEO:
      return translateRoomPreview('media.video')
    case MsgEnum.VOICE:
      return translateRoomPreview('media.audio')
    case MsgEnum.FILE:
      return translateRoomPreview('media.file')
    case MsgEnum.SYSTEM:
      return body.membership === 'join'
        ? translateRoomPreview('membership.join')
        : translateRoomPreview('membership.leave')
    case MsgEnum.TEXT:
      return (body.content ?? body.body ?? '') as string
    default:
      return translateRoomPreview('media.message')
  }
}
