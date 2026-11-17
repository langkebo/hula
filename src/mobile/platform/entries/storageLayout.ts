import { createMobileStorageLayout } from '@/mobile/platform/storageLayout'
import type { StorageLayout } from '@/platform/contracts'

/**
 * 存储布局入口（移动端装配）。
 *
 * 构建期由 vite alias 替换桌面默认实现（`src/platform/entries/storageLayout.ts`）；
 * 桌面产物不含本文件引用的 `src/mobile/platform/**` 实现。
 */
export const platformStorageLayout: () => StorageLayout = createMobileStorageLayout
