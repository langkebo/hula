/**
 * 扩展健康状态的**接收器注入点**。
 *
 * 为什么单独一层：
 * - `MatrixConnectionManager` 在 client 创建后需要把 SDK 扩展注册结果写进 capability store；
 * - 若服务层直接 import store，会形成 service → store 的反向依赖（S7）。
 *
 * 这里只保留一个可注入的 sink：应用入口在 pinia 激活后注册真正的写入实现，
 * 服务层只依赖本模块（无 Pinia、无浏览器依赖），可独立单测。
 * 未注册时静默跳过，行为等同于「诊断信息未收集」，不影响 client 创建。
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('ExtensionHealthSink')

/** 扩展健康状态：healthy=已注册，degraded=缺失但已降级，unknown=未检测 */
export type ExtensionHealthStatus = 'healthy' | 'degraded' | 'unknown'

/** 扩展名 → 健康状态 */
type ExtensionHealthMap = Record<string, ExtensionHealthStatus>

type ExtensionHealthReporter = (statuses: ExtensionHealthMap) => void

let reporter: ExtensionHealthReporter | null = null

/** 注册扩展健康状态接收器（应用入口在 pinia 激活后调用一次）。 */
export function registerExtensionHealthReporter(next: ExtensionHealthReporter): void {
  reporter = next
}

/** 上报一批扩展健康状态；接收器未注册或抛错时只记日志，不阻断连接流程。 */
export function reportExtensionHealth(statuses: ExtensionHealthMap): void {
  if (!reporter) {
    logger.debug('[扩展健康断言] 未注册健康状态接收器，跳过状态写入')
    return
  }
  try {
    reporter(statuses)
  } catch (error) {
    logger.debug('[扩展健康断言] 健康状态接收器执行失败，跳过状态写入', error)
  }
}
