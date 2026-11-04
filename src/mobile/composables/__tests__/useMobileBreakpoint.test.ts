import { describe, expect, it } from 'vitest'
import { resolveMobileBreakpoint } from '../useMobileBreakpoint'

describe('resolveMobileBreakpoint', () => {
  it('小于 600 为 compact', () => {
    expect(resolveMobileBreakpoint(0)).toBe('compact')
    expect(resolveMobileBreakpoint(599)).toBe('compact')
  })

  it('600 到 1024 为 medium', () => {
    expect(resolveMobileBreakpoint(600)).toBe('medium')
    expect(resolveMobileBreakpoint(768)).toBe('medium')
    expect(resolveMobileBreakpoint(1024)).toBe('medium')
  })

  it('大于 1024 为 expanded', () => {
    expect(resolveMobileBreakpoint(1025)).toBe('expanded')
    expect(resolveMobileBreakpoint(1440)).toBe('expanded')
  })
})
