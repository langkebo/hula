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

import { isNonMatrixWindow, MATRIX_WINDOW_LABELS, NON_MATRIX_WINDOW_LABELS } from '../windowLabels'

describe('windowLabels / isNonMatrixWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非 Tauri 运行时返回 false（保持默认行为）', () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    expect(isNonMatrixWindow()).toBe(false)
    expect(getCurrentMock).not.toHaveBeenCalled()
  })

  it('非 Matrix 窗口（截图/托盘/通知/更新/登录类）返回 true', () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    for (const label of NON_MATRIX_WINDOW_LABELS) {
      getCurrentMock.mockReturnValue({ label })
      expect(isNonMatrixWindow(), `label=${label}`).toBe(true)
    }
  })

  it('登录类窗口属于非 Matrix 窗口（只建立会话，不消费会话）', () => {
    // 语义变更记录：这批窗口原属 MATRIX_WINDOW_LABELS。
    // 改判理由见 windowLabels.ts 注释——自动登录走 useLoginOrchestrator 自己的分支，
    // 不依赖 recoverColdStartSession；而后者在登录窗口只会拿残留凭证去建 client。
    hasTauriRuntimeMock.mockReturnValue(true)
    for (const label of ['login', 'register', 'forgetPassword']) {
      getCurrentMock.mockReturnValue({ label })
      expect(isNonMatrixWindow(), `label=${label}`).toBe(true)
    }
  })

  it('Matrix 窗口（主窗/聊天/通话/设置）返回 false', () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    for (const label of ['home', 'message', 'call', 'settings', 'friend']) {
      getCurrentMock.mockReturnValue({ label })
      expect(isNonMatrixWindow(), `label=${label}`).toBe(false)
    }
  })

  it('两个名单互斥（同一 label 不得同时归类）', () => {
    // scripts/check-window-label-registry.mjs 的规则 2 也查这个，
    // 这里再锁一道：改名单时最容易犯的错是只加不删。
    for (const label of MATRIX_WINDOW_LABELS) {
      expect(NON_MATRIX_WINDOW_LABELS.has(label), `label=${label} 同时在两个名单`).toBe(false)
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
