import { createLogger } from '@/utils/Logger'
import { matrixE2EEBootstrapService } from './MatrixE2EEBootstrapService'

const logger = createLogger('E2EEStartup')

/**
 * 客户端启动后的 E2EE 引导入口。
 *
 * 独立成模块的原因：
 * 1. 引导失败不能阻断登录与收发消息（ADR-003 乐观渲染）；
 * 2. MatrixClientLifecycle 与 MatrixClientService 存在循环依赖，
 *    收敛到这里后由 lifecycle 动态 import，模块初始化期不触发环。
 */
export const startE2EE = async (): Promise<void> => {
  try {
    await matrixE2EEBootstrapService.bootstrapE2EE()
  } catch (err) {
    logger.warn(`E2EE 启动引导失败，已降级为明文可用: ${err}`)
  }
}

/** 登出/换号时复位 E2EE：停止健康巡检、清 crypto 缓存、复位初始化标记。 */
export const stopE2EE = (): void => {
  try {
    matrixE2EEBootstrapService.reset()
  } catch (err) {
    logger.warn(`E2EE 状态重置失败: ${err}`)
  }
}
