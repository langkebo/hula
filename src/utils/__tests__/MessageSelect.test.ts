import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { MULTI_SELECT_BLOCKED_TYPES, isMessageMultiSelectEnabled } from '../MessageSelect'

describe('MessageSelect', () => {
  it('blocks NOTICE, BOT, and RECALL message types', () => {
    expect(MULTI_SELECT_BLOCKED_TYPES.has(MsgEnum.NOTICE)).toBe(true)
    expect(MULTI_SELECT_BLOCKED_TYPES.has(MsgEnum.BOT)).toBe(true)
    expect(MULTI_SELECT_BLOCKED_TYPES.has(MsgEnum.RECALL)).toBe(true)
  })

  it('isMessageMultiSelectEnabled returns false for blocked types', () => {
    expect(isMessageMultiSelectEnabled(MsgEnum.NOTICE)).toBe(false)
    expect(isMessageMultiSelectEnabled(MsgEnum.BOT)).toBe(false)
    expect(isMessageMultiSelectEnabled(MsgEnum.RECALL)).toBe(false)
  })

  it('isMessageMultiSelectEnabled returns true for typical message types', () => {
    expect(isMessageMultiSelectEnabled(MsgEnum.IMAGE)).toBe(true)
    expect(isMessageMultiSelectEnabled(MsgEnum.FILE)).toBe(true)
    expect(isMessageMultiSelectEnabled(MsgEnum.VIDEO)).toBe(true)
    expect(isMessageMultiSelectEnabled(MsgEnum.VOICE)).toBe(true)
  })
})
