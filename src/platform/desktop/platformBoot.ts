import type { PlatformBoot } from '@/platform/contracts'

/**
 * 桌面端启动差异点：调试控制台与首屏完成信号均由别处负责，无需补充动作。
 */
export const desktopPlatformBoot: PlatformBoot = {
  afterPlatformInitialize: () => {}
}
