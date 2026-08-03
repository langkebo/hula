import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { getStrategy } from '../index'
import { TextMessageStrategyImpl } from '../text'
import { UnsupportedMessageStrategyImpl } from '../unsupported'

describe('getStrategy factory', () => {
  it('returns cached instance on second call for same type', async () => {
    const first = await getStrategy(MsgEnum.TEXT)
    const second = await getStrategy(MsgEnum.TEXT)
    expect(first).toBe(second)
  })

  it('returns TextMessageStrategyImpl for TEXT', async () => {
    const strategy = await getStrategy(MsgEnum.TEXT)
    expect(strategy).toBeInstanceOf(TextMessageStrategyImpl)
    expect(strategy.msgType).toBe(MsgEnum.TEXT)
  })

  it('returns UnsupportedMessageStrategyImpl for SYSTEM', async () => {
    const strategy = await getStrategy(MsgEnum.SYSTEM)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for RECALL', async () => {
    const strategy = await getStrategy(MsgEnum.RECALL)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for UNKNOWN', async () => {
    const strategy = await getStrategy(MsgEnum.UNKNOWN)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for NOTICE', async () => {
    const strategy = await getStrategy(MsgEnum.NOTICE)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for MERGE', async () => {
    const strategy = await getStrategy(MsgEnum.MERGE)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for MIXED', async () => {
    const strategy = await getStrategy(MsgEnum.MIXED)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for AIT', async () => {
    const strategy = await getStrategy(MsgEnum.AIT)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for REPLY', async () => {
    const strategy = await getStrategy(MsgEnum.REPLY)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for AI', async () => {
    const strategy = await getStrategy(MsgEnum.AI)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns UnsupportedMessageStrategyImpl for BOT', async () => {
    const strategy = await getStrategy(MsgEnum.BOT)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })

  it('returns same UnsupportedMessageStrategyImpl instance for different unsupported types', async () => {
    const sys = await getStrategy(MsgEnum.SYSTEM)
    const recall = await getStrategy(MsgEnum.RECALL)
    // All unsupported types share a single cached instance (keyed by UNKNOWN)
    expect(sys).toBe(recall)
  })

  it('lazy-loads IMAGE strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.IMAGE)
    expect(strategy.msgType).toBe(MsgEnum.IMAGE)
  })

  it('lazy-loads FILE strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.FILE)
    expect(strategy.msgType).toBe(MsgEnum.FILE)
  })

  it('lazy-loads VOICE strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.VOICE)
    expect(strategy.msgType).toBe(MsgEnum.VOICE)
  })

  it('lazy-loads VIDEO strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.VIDEO)
    expect(strategy.msgType).toBe(MsgEnum.VIDEO)
  })

  it('lazy-loads AUDIO strategy with VOICE strategy impl', async () => {
    const strategy = await getStrategy(MsgEnum.AUDIO)
    expect(strategy.msgType).toBe(MsgEnum.VOICE)
  })

  it('lazy-loads EMOJI strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.EMOJI)
    expect(strategy.msgType).toBe(MsgEnum.EMOJI)
  })

  it('lazy-loads VIDEO_CALL strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.VIDEO_CALL)
    expect(strategy.msgType).toBe(MsgEnum.VIDEO_CALL)
  })

  it('lazy-loads AUDIO_CALL strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.AUDIO_CALL)
    expect(strategy.msgType).toBe(MsgEnum.AUDIO_CALL)
  })

  it('lazy-loads LOCATION strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.LOCATION)
    expect(strategy.msgType).toBe(MsgEnum.LOCATION)
  })

  it('lazy-loads BEACON strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.BEACON)
    expect(strategy.msgType).toBe(MsgEnum.BEACON)
  })

  it('lazy-loads LINK_PREVIEW strategy with correct msgType', async () => {
    const strategy = await getStrategy(MsgEnum.LINK_PREVIEW)
    expect(strategy.msgType).toBe(MsgEnum.LINK_PREVIEW)
  })

  it('returns cached instance for lazy-loaded strategies', async () => {
    const first = await getStrategy(MsgEnum.IMAGE)
    const second = await getStrategy(MsgEnum.IMAGE)
    expect(first).toBe(second)
  })

  it('returns Unsupported strategy for unknown MsgEnum values', async () => {
    // Use a large number that's not in the enum
    const strategy = await getStrategy(9999 as MsgEnum)
    expect(strategy).toBeInstanceOf(UnsupportedMessageStrategyImpl)
  })
})
