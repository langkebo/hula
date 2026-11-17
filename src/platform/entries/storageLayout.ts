import type { StorageLayout } from '@/platform/contracts'
import { createDesktopStorageLayout } from '@/platform/desktop/storageLayout'

/**
 * 存储布局入口（默认装配：桌面）。
 *
 * 移动端构建与移动端 dev server 由 vite alias 把本模块整体替换为
 * `src/mobile/platform/entries/storageLayout.ts`（见 vite.config.ts），因此桌面产物
 * 不再静态包含 `src/mobile/platform/**`；运行期也不再做平台分派。
 *
 * 每个平台差异实现各占一个入口：单个聚合入口会把会话事件策略（依赖 `useWindow`）
 * 拉进只用存储布局的模块图，破坏原有模块边界。
 */
export const platformStorageLayout: () => StorageLayout = createDesktopStorageLayout
