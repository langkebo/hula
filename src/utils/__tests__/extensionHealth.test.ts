import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { reportExtensionDegradationToUi } from '@/utils/extensionHealth'

describe('reportExtensionDegradationToUi (O3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('降级时弹出 warning toast', () => {
    const cap = useCapabilityStore()
    cap.setExtensionHealth('friend-manager', 'degraded')

    const warningSpy = vi.fn()
    vi.stubGlobal('$message', { warning: warningSpy })

    reportExtensionDegradationToUi()

    expect(warningSpy).toHaveBeenCalledTimes(1)
    expect(warningSpy).toHaveBeenCalledWith(expect.stringContaining('friend-manager'))
  })

  it('无降级时不弹 toast', () => {
    const cap = useCapabilityStore()
    cap.setExtensionHealth('friend-manager', 'healthy')

    const warningSpy = vi.fn()
    vi.stubGlobal('$message', { warning: warningSpy })

    reportExtensionDegradationToUi()

    expect(warningSpy).not.toHaveBeenCalled()
  })

  it('extensionHealth 为空时不弹 toast', () => {
    const warningSpy = vi.fn()
    vi.stubGlobal('$message', { warning: warningSpy })

    reportExtensionDegradationToUi()

    expect(warningSpy).not.toHaveBeenCalled()
  })

  it('window.$message 不可用时不抛异常', () => {
    const cap = useCapabilityStore()
    cap.setExtensionHealth('friend-manager', 'degraded')

    vi.stubGlobal('$message', undefined)

    expect(() => reportExtensionDegradationToUi()).not.toThrow()
  })
})
