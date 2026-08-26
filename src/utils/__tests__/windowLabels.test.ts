import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentMock, hasTauriRuntimeMock } = vi.hoisted(() => ({
  getCurrentMock: vi.fn(),
  hasTauriRuntimeMock: vi.fn()
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: hasTauriRuntimeMock
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: getCurrentMock
  }
}))

import { isNonMatrixWindow, NON_MATRIX_WINDOW_LABELS } from '../windowLabels'

describe('windowLabels / isNonMatrixWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非 Tauri 运行时返回 false（保持默认行为）', () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    expect(isNonMatrixWindow()).toBe(false)
    expect(getCurrentMock).not.toHaveBeenCalled()
  })

  it('非 Matrix 窗口（截图/托盘/通知/更新）返回 true', () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    for (const label of NON_MATRIX_WINDOW_LABELS) {
      getCurrentMock.mockReturnValue({ label })
      expect(isNonMatrixWindow(), `label=${label}`).toBe(true)
    }
  })

  it('Matrix 窗口（主窗/登录/聊天/通话/设置）返回 false', () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    for (const label of ['home', 'login', 'message', 'call', 'settings', 'friend']) {
      getCurrentMock.mockReturnValue({ label })
      expect(isNonMatrixWindow(), `label=${label}`).toBe(false)
    }
  })

  it('窗口上下文不可用（getCurrent 抛错）时保守返回 false', () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    getCurrentMock.mockImplementation(() => {
      throw new Error('no window context')
    })
    expect(isNonMatrixWindow()).toBe(false)
  })
})
