import { MarkEnum } from '@/enums'

export interface QuickReactionEmoji {
  /** 用于 active 判定的枚举值 */
  value: MarkEnum
  /** Matrix reaction 协议标识（历史沿用的中文回执 key，勿修改） */
  key: string
  /** 展示用本地化文案 */
  title: string
  /** 图标资源路径 */
  url: string
}

export const createQuickReactionEmojis = (t: (key: string) => string): QuickReactionEmoji[] => [
  { value: MarkEnum.LIKE, key: '点赞', title: t('chat.reaction.like'), url: '/emojis/like.png' },
  { value: MarkEnum.HEART, key: '爱心', title: t('chat.reaction.heart'), url: '/emojis/heart.png' },
  { value: MarkEnum.LOL, key: '笑哭', title: t('chat.reaction.lol'), url: '/emojis/lol.png' },
  { value: MarkEnum.ANGRY, key: '愤怒', title: t('chat.reaction.angry'), url: '/emojis/angry.png' },
  { value: MarkEnum.ROCKET, key: '火箭', title: t('chat.reaction.rocket'), url: '/emojis/rocket.png' },
  { value: MarkEnum.FLOWER, key: '鲜花', title: t('chat.reaction.flower'), url: '/emojis/flower.png' }
]
