import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import type { CallInfo } from '../base'
import { VideoCallMessageStrategyImpl } from '../videoCall'

describe('VideoCallMessageStrategyImpl', () => {
  const strategy = new VideoCallMessageStrategyImpl()

  const makeCallInfo = (overrides: Partial<CallInfo> = {}): CallInfo => ({
    duration: 90,
    reason: 'completed',
    startTime: 5000,
    endTime: 5090,
    creator: '@dave:matrix.test',
    isGroup: false,
    ...overrides
  })

  const makeReply = (id: string, content: string, username: string): MessageType =>
    ({
      message: { id, body: { content } },
      fromUser: { username }
    }) as MessageType

  it('uses MsgEnum.VIDEO_CALL as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.VIDEO_CALL)
  })

  it('getMsg returns callInfo fields with type', () => {
    const callInfo = makeCallInfo()
    const msg = strategy.getMsg('', callInfo as unknown as MessageType) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.VIDEO_CALL)
    expect(msg.duration).toBe(90)
    expect(msg.reason).toBe('completed')
    expect(msg.startTime).toBe(5000)
    expect(msg.endTime).toBe(5090)
    expect(msg.creator).toBe('@dave:matrix.test')
    expect(msg.isGroup).toBe(false)
  })

  it('getMsg preserves group call info', () => {
    const callInfo = makeCallInfo({ isGroup: true, creator: '@eve:matrix.test' })
    const msg = strategy.getMsg('', callInfo as unknown as MessageType) as Record<string, unknown>
    expect(msg.isGroup).toBe(true)
    expect(msg.creator).toBe('@eve:matrix.test')
  })

  it('getMsg ignores msgInputValue', () => {
    const callInfo = makeCallInfo()
    const reply = makeReply('r-2', 'content', 'u')
    const msg = strategy.getMsg('ignored-input', {
      ...callInfo,
      ...reply
    } as unknown as MessageType) as Record<string, unknown>
    expect(msg.duration).toBe(90)
    expect(msg.creator).toBe('@dave:matrix.test')
  })

  it('buildMessageBody mirrors all call fields', () => {
    const body = strategy.buildMessageBody({
      type: MsgEnum.VIDEO_CALL,
      duration: 45,
      reason: 'missed',
      startTime: 7000,
      endTime: 7045,
      creator: '@frank:matrix.test',
      isGroup: true
    })
    expect(body).toEqual({
      duration: 45,
      reason: 'missed',
      startTime: 7000,
      endTime: 7045,
      creator: '@frank:matrix.test',
      isGroup: true
    })
  })

  it('buildMessageBody ignores reply parameter', () => {
    const body = strategy.buildMessageBody({
      type: MsgEnum.VIDEO_CALL,
      duration: 10,
      reason: 'declined',
      startTime: 0,
      endTime: 10,
      creator: 'c',
      isGroup: false
    })
    expect(body).not.toHaveProperty('reply')
    expect(body).not.toHaveProperty('replyMsgId')
  })

  it('uploadFile returns empty urls', async () => {
    const result = await strategy.uploadFile()
    expect(result.uploadUrl).toBe('')
    expect(result.downloadUrl).toBe('')
  })

  it('doUpload resolves without value', async () => {
    await expect(strategy.doUpload()).resolves.toBeUndefined()
  })

  it('getAllowedActions inherits base strategy', () => {
    const actions = strategy.getAllowedActions?.({ isMe: false, canModerate: false, isPinned: false }) ?? []
    expect(actions).toContain('reply')
    expect(actions).toContain('forward')
    expect(actions).toContain('mark')
    expect(actions).not.toContain('copy')
    expect(actions).not.toContain('edit')
    expect(actions).not.toContain('recall')
    expect(actions).not.toContain('pin')
    expect(actions).not.toContain('delete')
  })
})
