import { describe, it, expect } from 'vitest'
import { renderReplyContent } from '../RenderReplyContent'
import { MsgEnum, RoomTypeEnum } from '@/enums'

describe('renderReplyContent', () => {
  describe('TEXT messages', () => {
    it('returns name:content for group', () => {
      expect(renderReplyContent('Alice', MsgEnum.TEXT, 'hello', RoomTypeEnum.GROUP)).toBe('Alice:hello')
    })

    it('returns content only for DM', () => {
      expect(renderReplyContent('Alice', MsgEnum.TEXT, 'hello', RoomTypeEnum.SINGLE)).toBe('hello')
    })
  })

  describe('SYSTEM messages', () => {
    it('returns name:content for group', () => {
      expect(renderReplyContent('System', MsgEnum.SYSTEM, 'joined', RoomTypeEnum.GROUP)).toBe('System:joined')
    })
  })

  describe('IMAGE messages', () => {
    it('returns name:[图片] for group', () => {
      expect(renderReplyContent('Bob', MsgEnum.IMAGE, '', RoomTypeEnum.GROUP)).toBe('Bob:[图片]')
    })

    it('returns [图片] for DM', () => {
      expect(renderReplyContent('Bob', MsgEnum.IMAGE, '', RoomTypeEnum.SINGLE)).toBe('[图片]')
    })
  })

  describe('FILE messages', () => {
    it('returns name:filename for group with string content', () => {
      expect(renderReplyContent('Alice', MsgEnum.FILE, 'doc.pdf', RoomTypeEnum.GROUP)).toBe('Alice:doc.pdf')
    })

    it('returns [文件] filename for DM with string content', () => {
      expect(renderReplyContent('Alice', MsgEnum.FILE, 'doc.pdf', RoomTypeEnum.SINGLE)).toBe('[文件] doc.pdf')
    })

    it('falls back to [文件] for empty content', () => {
      expect(renderReplyContent('Alice', MsgEnum.FILE, '', RoomTypeEnum.SINGLE)).toBe('[文件] [文件]')
    })
  })

  describe('VOICE messages', () => {
    it('returns name:[语音] for group', () => {
      expect(renderReplyContent('Bob', MsgEnum.VOICE, '', RoomTypeEnum.GROUP)).toBe('Bob:[语音]')
    })

    it('returns [语音] for DM', () => {
      expect(renderReplyContent('Bob', MsgEnum.VOICE, '', RoomTypeEnum.SINGLE)).toBe('[语音]')
    })
  })

  describe('VIDEO messages', () => {
    it('returns [视频] for DM', () => {
      expect(renderReplyContent('', MsgEnum.VIDEO, '', RoomTypeEnum.SINGLE)).toBe('[视频]')
    })
  })

  describe('EMOJI messages', () => {
    it('returns [动画表情] for DM', () => {
      expect(renderReplyContent('', MsgEnum.EMOJI, '', RoomTypeEnum.SINGLE)).toBe('[动画表情]')
    })
  })

  describe('LOCATION messages', () => {
    it('returns name:[位置] for group', () => {
      expect(renderReplyContent('Alice', MsgEnum.LOCATION, '', RoomTypeEnum.GROUP)).toBe('Alice:[位置]')
    })
  })

  describe('VIDEO_CALL messages', () => {
    it('returns [视频通话] for DM', () => {
      expect(renderReplyContent('', MsgEnum.VIDEO_CALL, '', RoomTypeEnum.SINGLE)).toBe('[视频通话]')
    })
  })

  describe('AUDIO_CALL messages', () => {
    it('returns [语音通话] for DM', () => {
      expect(renderReplyContent('', MsgEnum.AUDIO_CALL, '', RoomTypeEnum.SINGLE)).toBe('[语音通话]')
    })
  })

  describe('default case', () => {
    it('returns empty string for unknown type', () => {
      expect(renderReplyContent('Alice', 999 as MsgEnum, 'content', RoomTypeEnum.GROUP)).toBe('')
    })

    it('returns empty string for undefined type', () => {
      expect(renderReplyContent('Alice', undefined, 'content', RoomTypeEnum.GROUP)).toBe('')
    })
  })
})
