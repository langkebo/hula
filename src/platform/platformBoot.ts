import type { PlatformBoot } from '@/platform/contracts'
import { platformBoot } from '@/platform/entries/platformBoot'

let currentPlatformBoot: PlatformBoot = platformBoot

/**
 * 注册运行期启动实现。
 * 默认取构建期平台入口（`@/platform/entries/platformBoot`，移动构建已被 alias 替换）；
 * 显式传参只用于测试注入。
 */
export const registerPlatformBoot = (boot: PlatformBoot = platformBoot): void => {
  currentPlatformBoot = boot
}

/**
 * 读取当前启动实现。默认平台绑定实现，未注册时行为与迁移前一致。
 */
export const getPlatformBoot = (): PlatformBoot => currentPlatformBoot
