import { mobileMobilePresence } from '@/mobile/platform/mobilePresence'
import type { MobilePresence } from '@/platform/contracts'

/**
 * 移动端能力存在性入口（移动端装配）。
 *
 * 构建期由 vite alias 替换桌面默认实现（`src/platform/entries/mobilePresence.ts`）；
 * 桌面产物不含本文件引用的 `src/mobile/platform/**` 实现。
 */
export const platformMobilePresence: MobilePresence = mobileMobilePresence
