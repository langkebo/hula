import { describe, it, expect } from 'vitest'
import { SignalTypeEnum } from '../types'

describe('SignalTypeEnum', () => {
  it('exposes the expected signalling types with wire-format values', () => {
    expect(SignalTypeEnum.JOIN).toBe('join')
    expect(SignalTypeEnum.OFFER).toBe('offer')
    expect(SignalTypeEnum.ANSWER).toBe('answer')
    expect(SignalTypeEnum.CANDIDATE).toBe('candidate')
    expect(SignalTypeEnum.LEAVE).toBe('leave')
  })

  it('has exactly the 5 canonical members', () => {
    const values = Object.values(SignalTypeEnum).filter((v) => typeof v === 'string')
    expect(values.sort()).toEqual(['answer', 'candidate', 'join', 'leave', 'offer'])
  })
})
