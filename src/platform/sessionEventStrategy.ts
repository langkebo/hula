import { mobileSessionEventStrategy } from '@/mobile/platform/sessionEventStrategy'
import type { SessionEventStrategy } from '@/platform/contracts'
import { desktopSessionEventStrategy } from '@/platform/desktop/sessionEventStrategy'

let currentSessionEventStrategy: SessionEventStrategy = desktopSessionEventStrategy

/**
 * 注册运行期会话事件策略。
 * 平台在运行期恒定，组合根（main.ts）在 initializePlatform 之后调用一次；
 * 传入 false 时回退桌面默认值，便于测试重置。
 */
export const registerSessionEventStrategy = (mobile: boolean): void => {
  currentSessionEventStrategy = mobile ? mobileSessionEventStrategy : desktopSessionEventStrategy
}

/**
 * 读取当前会话事件策略。默认桌面实现，未注册时行为与迁移前一致。
 */
export const getSessionEventStrategy = (): SessionEventStrategy => currentSessionEventStrategy
