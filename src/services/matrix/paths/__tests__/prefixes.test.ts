import { describe, expect, it } from 'vitest'
import { PREFIX_UNSTABLE, PREFIX_V1, PREFIX_V3 } from '../prefixes'

describe('PREFIX constants', () => {
  it('PREFIX_V1', () => {
    expect(PREFIX_V1).toBe('/_matrix/client/v1')
  })
  it('PREFIX_V3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })
  it('PREFIX_UNSTABLE', () => {
    expect(PREFIX_UNSTABLE).toBe('/_matrix/client/unstable')
  })
})
