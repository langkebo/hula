import { describe, expect, it } from 'vitest'
import { AppException } from '@/common/exception'
import { UnsupportedMessageStrategyImpl } from '../unsupported'

describe('UnsupportedMessageStrategyImpl', () => {
  it('getMsg throws AppException with friendly message', () => {
    const strategy = new UnsupportedMessageStrategyImpl()
    expect(() => strategy.getMsg('text', null)).toThrow(AppException)
    expect(() => strategy.getMsg('text', null)).toThrow('暂不支持该类型消息')
  })

  it('buildMessageBody throws AppException', () => {
    const strategy = new UnsupportedMessageStrategyImpl()
    expect(() => strategy.buildMessageBody({}, null)).toThrow(AppException)
    expect(() => strategy.buildMessageBody({}, null)).toThrow('方法暂未实现')
  })

  it('buildMessageType throws AppException', () => {
    const strategy = new UnsupportedMessageStrategyImpl()
    expect(() =>
      strategy.buildMessageType('id', {}, { currentSessionRoomId: 'room' }, { value: 'uid' } as any)
    ).toThrow(AppException)
  })
})
