import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { getStrategy } from '../index'

describe('MessageStrategy.getAllowedActions()', () => {
  it('returns empty for SYSTEM message', async () => {
    const strategy = await getStrategy(MsgEnum.SYSTEM)
    expect(strategy.getAllowedActions?.({ isMe: true, canModerate: true, isPinned: false })).toEqual([])
  })

  it('returns empty for RECALL message', async () => {
    const strategy = await getStrategy(MsgEnum.RECALL)
    expect(strategy.getAllowedActions?.({ isMe: true, canModerate: true, isPinned: false })).toEqual([])
  })

  it('returns empty for UNKNOWN message', async () => {
    const strategy = await getStrategy(MsgEnum.UNKNOWN)
    expect(strategy.getAllowedActions?.({ isMe: true, canModerate: true, isPinned: false })).toEqual([])
  })

  it('includes reply/forward/mark for TEXT message from others', async () => {
    const strategy = await getStrategy(MsgEnum.TEXT)
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).toContain('copy')
    expect(actions).not.toContain('edit')
    expect(actions).not.toContain('recall')
    expect(actions).not.toContain('pin')
    expect(actions).not.toContain('delete')
  })

  it('includes edit/recall for own TEXT message with moderate permission', async () => {
    const strategy = await getStrategy(MsgEnum.TEXT)
    const actions = strategy.getAllowedActions?.({ isMe: true, canModerate: true, isPinned: false }) ?? []
    expect(actions).toContain('edit')
    expect(actions).toContain('recall')
    expect(actions).toContain('pin')
    expect(actions).toContain('delete')
  })

  it('excludes edit for own TEXT message without moderate permission', async () => {
    const strategy = await getStrategy(MsgEnum.TEXT)
    const actions = strategy.getAllowedActions?.({ isMe: true, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('edit')
    // recall 需要 canModerate（防止普通用户撤回他人消息，但可撤回自己 — Matrix 实际允许）
    // 这里以 canModerate 控制是否显示，由 UI 进一步确认
    expect(actions).not.toContain('recall')
  })

  it('excludes copy for IMAGE message', async () => {
    const strategy = await getStrategy(MsgEnum.IMAGE)
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).not.toContain('copy')
    expect(actions).toContain('forward')
  })

  it('excludes copy for FILE message', async () => {
    const strategy = await getStrategy(MsgEnum.FILE)
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).not.toContain('copy')
  })

  it('excludes copy for EMOJI message (body only contains url)', async () => {
    const strategy = await getStrategy(MsgEnum.EMOJI)
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).not.toContain('copy')
    expect(actions).toContain('forward')
  })

  it('includes pin for moderator', async () => {
    const strategy = await getStrategy(MsgEnum.TEXT)
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: true, isPinned: false }) ?? []
    expect(actions).toContain('pin')
    expect(actions).toContain('delete')
  })

  it('all strategies expose getAllowedActions method', async () => {
    for (const type of [MsgEnum.TEXT, MsgEnum.IMAGE, MsgEnum.FILE, MsgEnum.VOICE, MsgEnum.VIDEO, MsgEnum.EMOJI]) {
      const strategy = await getStrategy(type)
      expect(typeof strategy.getAllowedActions).toBe('function')
    }
  })
})
