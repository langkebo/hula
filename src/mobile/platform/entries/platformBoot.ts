import { mobilePlatformBoot } from '@/mobile/platform/platformBoot'
import type { PlatformBoot } from '@/platform/contracts'

/**
 * 启动实现入口（移动端装配）。
 *
 * 构建期由 vite alias 替换桌面默认实现（`src/platform/entries/platformBoot.ts`）；
 * 桌面产物不含本文件引用的 `src/mobile/platform/**` 实现。
 */
export const platformBoot: PlatformBoot = mobilePlatformBoot
