import { MsgEnum } from '@/enums'
import { AudioCallMessageStrategyImpl } from './audioCall'
import { BeaconMessageStrategyImpl } from './beacon'
import { EmojiMessageStrategyImpl } from './emoji'
import { FileMessageStrategyImpl } from './file'
import { ImageMessageStrategyImpl } from './image'
import { LinkPreviewMessageStrategyImpl } from './linkPreview'
import { LocationMessageStrategyImpl } from './location'
import { TextMessageStrategyImpl } from './text'
import { UnsupportedMessageStrategyImpl } from './unsupported'
import { VideoCallMessageStrategyImpl } from './videoCall'
import { VideoMessageStrategyImpl } from './video'
import { VoiceMessageStrategyImpl } from './voice'
import type { MessageStrategy } from './base'

export * from './base'
export { AudioCallMessageStrategyImpl } from './audioCall'
export { BeaconMessageStrategyImpl } from './beacon'
export { EmojiMessageStrategyImpl } from './emoji'
export { FileMessageStrategyImpl } from './file'
export { ImageMessageStrategyImpl } from './image'
export { LinkPreviewMessageStrategyImpl } from './linkPreview'
export { LocationMessageStrategyImpl } from './location'
export { TextMessageStrategyImpl } from './text'
export { UnsupportedMessageStrategyImpl } from './unsupported'
export { VideoCallMessageStrategyImpl } from './videoCall'
export { VideoMessageStrategyImpl } from './video'
export { VoiceMessageStrategyImpl } from './voice'

const textMessageStrategy = new TextMessageStrategyImpl()
const fileMessageStrategy = new FileMessageStrategyImpl()
const imageMessageStrategy = new ImageMessageStrategyImpl()
const emojiMessageStrategy = new EmojiMessageStrategyImpl()
const unsupportedMessageStrategy = new UnsupportedMessageStrategyImpl()
const videoMessageStrategy = new VideoMessageStrategyImpl()
const voiceMessageStrategy = new VoiceMessageStrategyImpl()
const videoCallMessageStrategy = new VideoCallMessageStrategyImpl()
const audioCallMessageStrategy = new AudioCallMessageStrategyImpl()
const locationMessageStrategy = new LocationMessageStrategyImpl()
const beaconMessageStrategy = new BeaconMessageStrategyImpl()
const linkPreviewMessageStrategy = new LinkPreviewMessageStrategyImpl()

export const messageStrategyMap: Record<MsgEnum, MessageStrategy> = {
  [MsgEnum.FILE]: fileMessageStrategy,
  [MsgEnum.IMAGE]: imageMessageStrategy,
  [MsgEnum.TEXT]: textMessageStrategy,
  [MsgEnum.NOTICE]: unsupportedMessageStrategy,
  [MsgEnum.MERGE]: unsupportedMessageStrategy,
  [MsgEnum.EMOJI]: emojiMessageStrategy,
  [MsgEnum.UNKNOWN]: unsupportedMessageStrategy,
  [MsgEnum.RECALL]: unsupportedMessageStrategy,
  [MsgEnum.VOICE]: voiceMessageStrategy,
  [MsgEnum.VIDEO]: videoMessageStrategy,
  [MsgEnum.SYSTEM]: unsupportedMessageStrategy,
  [MsgEnum.MIXED]: unsupportedMessageStrategy,
  [MsgEnum.AIT]: unsupportedMessageStrategy,
  [MsgEnum.REPLY]: unsupportedMessageStrategy,
  [MsgEnum.AI]: unsupportedMessageStrategy,
  [MsgEnum.BOT]: unsupportedMessageStrategy,
  [MsgEnum.VIDEO_CALL]: videoCallMessageStrategy,
  [MsgEnum.AUDIO_CALL]: audioCallMessageStrategy,
  [MsgEnum.LOCATION]: locationMessageStrategy,
  [MsgEnum.AUDIO]: voiceMessageStrategy,
  [MsgEnum.BEACON]: beaconMessageStrategy,
  [MsgEnum.LINK_PREVIEW]: linkPreviewMessageStrategy
}
