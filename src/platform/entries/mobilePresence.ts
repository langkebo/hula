import type { MobilePresence } from '@/platform/contracts'
import { desktopMobilePresence } from '@/platform/desktop/mobilePresence'

/**
 * 移动端能力存在性入口（默认装配：桌面）。
 *
 * 移动端构建与移动端 dev server 由 vite alias 把本模块整体替换为
 * `src/mobile/platform/entries/mobilePresence.ts`（见 vite.config.ts）。
 * 桌面产物因此不含移动端实现，消费方也不再依赖运行期平台谓词分支。
 */
export const platformMobilePresence: MobilePresence = desktopMobilePresence
