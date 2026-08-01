import { describe, expect, it } from 'vitest'
import { EmojiAsset } from '../EmojiAsset'

describe('EmojiAsset', () => {
  describe('reactionUrl', () => {
    it('构建 msgAction 目录下的反应表情 URL (.png)', () => {
      expect(EmojiAsset.reactionUrl('like')).toBe('/msgAction/like.png')
      expect(EmojiAsset.reactionUrl('heart-on-fire')).toBe('/msgAction/heart-on-fire.png')
      expect(EmojiAsset.reactionUrl('face-with-tears-of-joy')).toBe('/msgAction/face-with-tears-of-joy.png')
    })

    it('处理带空白的文件名', () => {
      expect(EmojiAsset.reactionUrl('  bomb  ')).toBe('/msgAction/bomb.png')
    })
  })

  describe('emojiUrl', () => {
    it('构建 emoji 目录下的通用表情 URL (.webp)', () => {
      expect(EmojiAsset.emojiUrl('party-popper')).toBe('/emoji/party-popper.webp')
      expect(EmojiAsset.emojiUrl('rocket')).toBe('/emoji/rocket.webp')
    })

    it('处理带空白的文件名', () => {
      expect(EmojiAsset.emojiUrl('  fire  ')).toBe('/emoji/fire.webp')
    })
  })

  describe('路径前缀常量', () => {
    it('暴露 msgAction 目录前缀', () => {
      expect(EmojiAsset.MSG_ACTION_PREFIX).toBe('/msgAction')
    })

    it('暴露 emoji 目录前缀', () => {
      expect(EmojiAsset.EMOJI_PREFIX).toBe('/emoji')
    })
  })
})
