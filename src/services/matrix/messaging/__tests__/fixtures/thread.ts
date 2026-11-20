import type { ThreadStatistics, ThreadSubscription } from '@/services/matrix/messaging/threadTypes'

/**
 * 线程（Thread）域测试夹具。
 *
 * `MatrixThreadApi` 已把 SDK 的 snake_case 响应映射成 camelCase 的
 * `ThreadSubscription` / `ThreadStatistics`，夹具直接站在这个映射结果上。
 */

/** 生成线程订阅状态；默认是「已静音」。 */
export function makeThreadSubscription(overrides: Partial<ThreadSubscription> = {}): ThreadSubscription {
  return { notificationLevel: 'muted', isMuted: true, ...overrides }
}

/** 生成线程统计；默认 3 条回复、2 位参与者、无编辑/撤回。 */
export function makeThreadStatistics(overrides: Partial<ThreadStatistics> = {}): ThreadStatistics {
  return {
    totalReplies: 3,
    totalParticipants: 2,
    totalEdits: 0,
    totalRedactions: 0,
    ...overrides
  }
}
