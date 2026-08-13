import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindow } from '@/composables/common/useWindow'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'
import type { SessionRuntimeHost } from './sessionRuntimeInternal'

const logger = createLogger('DesktopSessionTransition')

/**
 * Desktop-only window transitions after login: resize the tray window,
 * close the register window, and open the main home window.
 * All methods are no-ops on mobile or non-Tauri (browser/E2E) runtimes.
 */
export class DesktopSessionTransition {
  constructor(private readonly host: SessionRuntimeHost) {}

  /** 应用桌面端登录状态
   */
  async applyDesktopLoginState(): Promise<void> {
    const port = this.host.port
    try {
      if (!isDesktop() || !hasTauriRuntime()) {
        return
      }

      const { resizeWindow } = useWindow()

      port.global.setTrayMenuShow(true)
      await resizeWindow('tray', 130, 356)
    } catch (err) {
      logger.error(`应用桌面端登录状态失败: ${err}`)
    }
  }

  /** 打开桌面端主窗口
   */
  async openDesktopHomeWindow(): Promise<void> {
    try {
      if (!isDesktop() || !hasTauriRuntime()) {
        return
      }

      const { createWebviewWindow } = useWindow()
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch((err) => {
          logger.warn('关闭注册窗口失败:', err)
        })
      }

      // Step 2.3：窗口最小宽度 1024px，配合响应式断点（wide≥1440 / normal 1024-1439 / shrink<1024）
      await createWebviewWindow('Tjg', 'home', 1280, 800, 'login', true, 1024, 600, undefined, false)
    } catch (err) {
      logger.error(`打开桌面端主窗口失败: ${err}`)
    }
  }

  /** 完成桌面端登录转换流程
   */
  async completeDesktopLoginTransition(): Promise<void> {
    try {
      await this.applyDesktopLoginState()
      await this.openDesktopHomeWindow()
    } catch (err) {
      logger.error(`完成桌面端登录过渡失败: ${err}`)
    }
  }
}
