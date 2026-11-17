import type { SessionEventStrategy } from '@/platform/contracts'
import { platformSessionEventStrategy } from '@/platform/entries/sessionEventStrategy'

let currentSessionEventStrategy: SessionEventStrategy = platformSessionEventStrategy

/**
 * 注册运行期会话事件策略。
 * 默认取构建期平台入口（`@/platform/entries/sessionEventStrategy`，移动构建已被 alias 替换）；
 * 显式传参只用于测试注入。
 */
export const registerSessionEventStrategy = (strategy: SessionEventStrategy = platformSessionEventStrategy): void => {
  currentSessionEventStrategy = strategy
}

/**
 * 读取当前会话事件策略。默认平台绑定实现，未注册时行为与迁移前一致。
 */
export const getSessionEventStrategy = (): SessionEventStrategy => currentSessionEventStrategy
