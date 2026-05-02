import { MsgEnum } from '@/enums'
import type { MessageStrategy } from './base'
import { strategyLogger } from './base'
import { TextMessageStrategyImpl } from './text'
import { UnsupportedMessageStrategyImpl } from './unsupported'

export { AudioCallMessageStrategyImpl } from './audioCall'
export * from './base'
export { BeaconMessageStrategyImpl } from './beacon'
export { EmojiMessageStrategyImpl } from './emoji'
export { FileMessageStrategyImpl } from './file'
export { ImageMessageStrategyImpl } from './image'
export { LinkPreviewMessageStrategyImpl } from './linkPreview'
export { LocationMessageStrategyImpl } from './location'
export { TextMessageStrategyImpl } from './text'
export { UnsupportedMessageStrategyImpl } from './unsupported'
export { VideoMessageStrategyImpl } from './video'
export { VideoCallMessageStrategyImpl } from './videoCall'
export { VoiceMessageStrategyImpl } from './voice'

const strategyCache = new Map<MsgEnum, MessageStrategy>()

const UNSUPPORTED_KEYS: MsgEnum[] = [
  MsgEnum.NOTICE,
  MsgEnum.MERGE,
  MsgEnum.UNKNOWN,
  MsgEnum.RECALL,
  MsgEnum.SYSTEM,
  MsgEnum.MIXED,
  MsgEnum.AIT,
  MsgEnum.REPLY,
  MsgEnum.AI,
  MsgEnum.BOT
]

type StrategyLoader = () => Promise<{ default: new () => MessageStrategy }>

const lazyStrategies: Partial<Record<MsgEnum, StrategyLoader>> = {
  [MsgEnum.FILE]: () => import('./file').then((m) => ({ default: m.FileMessageStrategyImpl })),
  [MsgEnum.IMAGE]: () => import('./image').then((m) => ({ default: m.ImageMessageStrategyImpl })),
  [MsgEnum.EMOJI]: () => import('./emoji').then((m) => ({ default: m.EmojiMessageStrategyImpl })),
  [MsgEnum.VOICE]: () => import('./voice').then((m) => ({ default: m.VoiceMessageStrategyImpl })),
  [MsgEnum.VIDEO]: () => import('./video').then((m) => ({ default: m.VideoMessageStrategyImpl })),
  [MsgEnum.AUDIO]: () => import('./voice').then((m) => ({ default: m.VoiceMessageStrategyImpl })),
  [MsgEnum.VIDEO_CALL]: () => import('./videoCall').then((m) => ({ default: m.VideoCallMessageStrategyImpl })),
  [MsgEnum.AUDIO_CALL]: () => import('./audioCall').then((m) => ({ default: m.AudioCallMessageStrategyImpl })),
  [MsgEnum.LOCATION]: () => import('./location').then((m) => ({ default: m.LocationMessageStrategyImpl })),
  [MsgEnum.BEACON]: () => import('./beacon').then((m) => ({ default: m.BeaconMessageStrategyImpl })),
  [MsgEnum.LINK_PREVIEW]: () => import('./linkPreview').then((m) => ({ default: m.LinkPreviewMessageStrategyImpl }))
}

function getUnsupportedStrategy(): MessageStrategy {
  let s = strategyCache.get(MsgEnum.UNKNOWN)
  if (!s) {
    s = new UnsupportedMessageStrategyImpl()
    strategyCache.set(MsgEnum.UNKNOWN, s)
  }
  return s
}

export async function getStrategy(type: MsgEnum): Promise<MessageStrategy> {
  const cached = strategyCache.get(type)
  if (cached) return cached

  if (UNSUPPORTED_KEYS.includes(type)) {
    const s = getUnsupportedStrategy()
    strategyCache.set(type, s)
    return s
  }

  if (type === MsgEnum.TEXT) {
    const s = new TextMessageStrategyImpl()
    strategyCache.set(type, s)
    return s
  }

  const loader = lazyStrategies[type]
  if (loader) {
    const StrategyClass = (await loader()).default
    const s = new StrategyClass()
    strategyCache.set(type, s)
    return s
  }

  const s = getUnsupportedStrategy()
  strategyCache.set(type, s)
  return s
}

export const messageStrategyMap: Record<MsgEnum, MessageStrategy> = new Proxy({} as Record<MsgEnum, MessageStrategy>, {
  get(_target, prop: string) {
    const key = Number(prop) as MsgEnum
    const cached = strategyCache.get(key)
    if (cached) return cached

    if (UNSUPPORTED_KEYS.includes(key)) return getUnsupportedStrategy()
    if (key === MsgEnum.TEXT) {
      const s = new TextMessageStrategyImpl()
      strategyCache.set(key, s)
      return s
    }

    const loader = lazyStrategies[key]
    if (loader) {
      strategyLogger.warn(`同步访问懒加载策略 MsgEnum.${key} 会触发 eager 加载，建议使用 await getStrategy() 代替`)
      let resolved: MessageStrategy | undefined
      loader().then((mod) => {
        resolved = new mod.default()
        strategyCache.set(key, resolved)
      })
      return getUnsupportedStrategy()
    }

    return getUnsupportedStrategy()
  }
})
