import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AudioCallMessageStrategyImpl } from '../audioCall'
import type { CallInfo } from '../base'

describe('AudioCallMessageStrategyImpl', () => {
  const strategy = new AudioCallMessageStrategyImpl()

  const makeCallInfo = (overrides: Partial<CallInfo> = {}): CallInfo => ({
    duration: 120,
    reason: 'normal',
    startTime: 1000,
    endTime: 1120,
    creator: '@alice:matrix.test',
    isGroup: false,
    ...overrides
  })

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.AUDIO_CALL as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.AUDIO_CALL)
  })

  it('getMsg returns callInfo fields with type', () => {
    const callInfo = makeCallInfo()
    const msg = strategy.getMsg('', callInfo as unknown as MessageType) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.AUDIO_CALL)
    expect(msg.duration).toBe(120)
    expect(msg.reason).toBe('normal')
    expect(msg.startTime).toBe(1000)
    expect(msg.endTime).toBe(1120)
    expect(msg.creator).toBe('@alice:matrix.test')
    expect(msg.isGroup).toBe(false)
  })

  it('getMsg preserves group call info', () => {
    const callInfo = makeCallInfo({ isGroup: true, creator: '@bob:matrix.test' })
    const msg = strategy.getMsg('', callInfo as unknown as MessageType) as Record<string, unknown>
    expect(msg.isGroup).toBe(true)
    expect(msg.creator).toBe('@bob:matrix.test')
  })

  it('getMsg ignores msgInputValue and replyValue', () => {
    const callInfo = makeCallInfo()
    const reply = makeReply('r-1', 'content', 'u')
    const msg = strategy.getMsg('ignored', {
      ...callInfo,
      ...reply
    } as unknown as MessageType) as Record<string, unknown>
    // Only callInfo fields are extracted, replyValue fields are ignored
    expect(msg.duration).toBe(120)
    expect(msg.creator).toBe('@alice:matrix.test')
  })

  it('buildMessageBody mirrors all call fields', () => {
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.AUDIO_CALL,
        duration: 60,
        reason: 'busy',
        startTime: 2000,
        endTime: 2060,
        creator: '@carol:matrix.test',
        isGroup: true
      },
      null
    )
    expect(body).toEqual({
      duration: 60,
      reason: 'busy',
      startTime: 2000,
      endTime: 2060,
      creator: '@carol:matrix.test',
      isGroup: true
    })
  })

  it('buildMessageBody ignores reply parameter', () => {
    const reply = makeReply('evt-1', 'hi', 'bob')
    const body = strategy.buildMessageBody(
      {
        type: MsgEnum.AUDIO_CALL,
        duration: 30,
        reason: 'x',
        startTime: 0,
        endTime: 30,
        creator: 'c',
        isGroup: false
      },
      reply
    )
    // reply 参数被忽略
    expect(body).not.toHaveProperty('reply')
    expect(body).not.toHaveProperty('replyMsgId')
  })

  it('uploadFile returns empty urls', async () => {
    const result = await strategy.uploadFile('/some/path')
    expect(result.uploadUrl).toBe('')
    expect(result.downloadUrl).toBe('')
  })

  it('doUpload resolves without value', async () => {
    await expect(strategy.doUpload()).resolves.toBeUndefined()
  })

  it('getAllowedActions inherits base strategy (reply/forward/mark + isMe/canModerate)', () => {
    // AUDIO_CALL does not override getAllowedActions, so base behavior applies
    const actions = strategy.getAllowedActions?.({ isMe: true, canModerate: true, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).toContain('edit')
    expect(actions).toContain('recall')
    expect(actions).toContain('pin')
    expect(actions).toContain('delete')
    // AUDIO_CALL is not TEXT, so no copy
    expect(actions).not.toContain('copy')
  })
})
