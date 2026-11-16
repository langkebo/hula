import type { PlatformBoot } from '@/platform/contracts'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const initDebugConsole = (): void => {
  if (process.env.NODE_ENV !== 'development') return
  import('eruda').then((module) => {
    const eruda = 'default' in module ? module.default : module
    eruda.init()
  })
}

const notifyFrontendReady = async (): Promise<void> => {
  if (!hasTauriRuntime()) return
  await invokeSilently('set_complete', { task: 'frontend' })
}

/**
 * 移动端启动差异点：开发期注入 eruda，并在 DOM 就绪后通知原生启动屏放行。
 */
export const mobilePlatformBoot: PlatformBoot = {
  afterPlatformInitialize: () => {
    initDebugConsole()
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => void notifyFrontendReady(), { once: true })
    } else {
      void notifyFrontendReady()
    }
  }
}
