import type { PlatformBoot } from '@/platform/contracts'
import { desktopPlatformBoot } from '@/platform/desktop/platformBoot'

/**
 * 启动实现入口（默认装配：桌面）。
 *
 * 移动端构建与移动端 dev server 由 vite alias 把本模块整体替换为
 * `src/mobile/platform/entries/platformBoot.ts`（见 vite.config.ts）。
 */
export const platformBoot: PlatformBoot = desktopPlatformBoot
