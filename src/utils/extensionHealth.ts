import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ExtensionHealth')

/**
 * O3: 启动后检测扩展降级状态，通过 toast 向用户暴露。
 *
 * 在 bootstrapPostLoginState 末尾调用。
 * 仅当 hasDegradedExtension=true 时弹一次 non-blocking warning toast，
 * 不影响基础使用。详细明细可在设置 > 帮助 > 诊断面板查看。
 */
export function reportExtensionDegradationToUi(): void {
  try {
    const cap = useCapabilityStore()
    if (!cap.hasDegradedExtension) return

    const degraded = Object.entries(cap.extensionHealth)
      .filter(([, status]) => status === 'degraded')
      .map(([id]) => id)

    if (degraded.length === 0) return

    logger.warn(`[ExtensionHealth] 检测到降级扩展: ${degraded.join(', ')}`)
    window.$message?.warning?.(`部分功能已降级（${degraded.join(', ')}），不影响基础使用`)
  } catch (err) {
    // 降级提示是 non-blocking 的，不应影响主流程
    logger.warn(`[ExtensionHealth] 降级提示失败（已忽略）: ${err}`)
  }
}
