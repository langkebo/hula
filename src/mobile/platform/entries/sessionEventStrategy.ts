import { mobileSessionEventStrategy } from '@/mobile/platform/sessionEventStrategy'
import type { SessionEventStrategy } from '@/platform/contracts'

/**
 * 会话事件策略入口（移动端装配）。
 *
 * 构建期由 vite alias 替换桌面默认实现（`src/platform/entries/sessionEventStrategy.ts`）；
 * 桌面产物不含本文件引用的 `src/mobile/platform/**` 实现。
 */
export const platformSessionEventStrategy: SessionEventStrategy = mobileSessionEventStrategy
