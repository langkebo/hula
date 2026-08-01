import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const platformMock = vi.hoisted(() => ({
  isMac: vi.fn(() => true)
}))

vi.mock('@/utils/PlatformConstants', () => platformMock)

import { createMacContextSelectionGuard } from '../MacSelectionGuard'

const createMockSelection = (opts: { isCollapsed: boolean; text: string }) => ({
  isCollapsed: opts.isCollapsed,
  toString: () => opts.text,
  removeAllRanges: vi.fn(),
  getRangeAt: vi.fn(),
  addRange: vi.fn(),
  removeRange: vi.fn(),
  collapse: vi.fn()
})

describe('createMacContextSelectionGuard', () => {
  let originalGetSelection: typeof window.getSelection

  beforeEach(() => {
    originalGetSelection = window.getSelection
    platformMock.isMac.mockReturnValue(true)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((_cb: FrameRequestCallback) => 0)
    )
  })

  afterEach(() => {
    window.getSelection = originalGetSelection
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('when isMac returns false', () => {
    beforeEach(() => {
      platformMock.isMac.mockReturnValue(false)
    })

    it('recordSelectionBeforeContext does not process events', () => {
      const getSelectionSpy = vi.fn()
      window.getSelection = getSelectionSpy as unknown as typeof window.getSelection

      const guard = createMacContextSelectionGuard()
      guard.recordSelectionBeforeContext({ button: 2 } as MouseEvent)

      expect(getSelectionSpy).not.toHaveBeenCalled()
    })

    it('handleContextMenuSelection does not process events', () => {
      const getSelectionSpy = vi.fn()
      window.getSelection = getSelectionSpy as unknown as typeof window.getSelection

      const target = document.createElement('div')
      const guard = createMacContextSelectionGuard()
      guard.handleContextMenuSelection({ target } as unknown as Event)

      expect(getSelectionSpy).not.toHaveBeenCalled()
      expect(target.classList.contains('select-none')).toBe(false)
    })
  })

  describe('recordSelectionBeforeContext', () => {
    it('does not record when button !== 2', () => {
      const getSelectionSpy = vi.fn()
      window.getSelection = getSelectionSpy as unknown as typeof window.getSelection

      const guard = createMacContextSelectionGuard()
      guard.recordSelectionBeforeContext({ button: 0 } as MouseEvent)
      guard.recordSelectionBeforeContext({ button: 1 } as MouseEvent)

      expect(getSelectionSpy).not.toHaveBeenCalled()
    })
  })

  describe('handleContextMenuSelection', () => {
    it('preserves selection when there is a selection before context', () => {
      const selection = createMockSelection({ isCollapsed: false, text: 'selected text' })
      window.getSelection = vi.fn(() => selection) as unknown as typeof window.getSelection

      const target = document.createElement('div')
      const guard = createMacContextSelectionGuard()

      // 记录存在选区
      guard.recordSelectionBeforeContext({ button: 2, target } as unknown as MouseEvent)

      guard.handleContextMenuSelection({ target } as unknown as Event)

      expect(selection.removeAllRanges).not.toHaveBeenCalled()
      expect(target.classList.contains('select-none')).toBe(false)
    })

    it('clears selection and adds select-none class when no selection', () => {
      const selection = createMockSelection({ isCollapsed: true, text: '' })
      window.getSelection = vi.fn(() => selection) as unknown as typeof window.getSelection

      const target = document.createElement('div')
      const guard = createMacContextSelectionGuard()

      guard.handleContextMenuSelection({ target } as unknown as Event)

      expect(selection.removeAllRanges).toHaveBeenCalledTimes(1)
      expect(target.classList.contains('select-none')).toBe(true)
    })
  })
})
