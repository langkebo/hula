import { mobilePlatformBoot } from '@/mobile/platform/platformBoot'
import type { PlatformBoot } from '@/platform/contracts'
import { desktopPlatformBoot } from '@/platform/desktop/platformBoot'

let currentPlatformBoot: PlatformBoot = desktopPlatformBoot

/**
 * 注册运行期启动实现。
 * 平台在运行期恒定，组合根（main.ts）在 initializePlatform 之后调用一次；
 * 传入 false 时回退桌面默认值，便于测试重置。
 */
export const registerPlatformBoot = (mobile: boolean): void => {
  currentPlatformBoot = mobile ? mobilePlatformBoot : desktopPlatformBoot
}

/**
 * 读取当前启动实现。默认桌面实现，未注册时行为与迁移前一致。
 */
export const getPlatformBoot = (): PlatformBoot => currentPlatformBoot
