import type { SessionEventStrategy } from '@/platform/contracts'
import { desktopSessionEventStrategy } from '@/platform/desktop/sessionEventStrategy'

/**
 * 会话事件策略入口（默认装配：桌面）。
 *
 * 移动端构建与移动端 dev server 由 vite alias 把本模块整体替换为
 * `src/mobile/platform/entries/sessionEventStrategy.ts`（见 vite.config.ts）。
 */
export const platformSessionEventStrategy: SessionEventStrategy = desktopSessionEventStrategy
