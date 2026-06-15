/**
 * 应用韧性模块 — 系统级崩溃恢复与健康探针前端消费层
 *
 * 消费 Rust 后端已实现的事件：
 * - system-resumed: 系统从休眠恢复
 * - app-state-ready: 应用数据库就绪
 * - 连接健康探针结果（通过 homeserver-health 事件）
 *
 * 参考 element-desktop 的连接韧性模式：
 * - 渲染进程崩溃自动重载
 * - 系统休眠恢复重载
 * - Homeserver 健康探针（指数退避，Rust 已实现）
 */
import { ref } from 'vue'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { useTauriListener } from '@/hooks/useTauriListener'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AppResilience')

export interface ResilienceState {
  /** 应用是否已完全就绪（数据库初始化完成） */
  appReady: boolean
  /** 系统是否刚从休眠恢复 */
  justResumed: boolean
  /** 最近一次恢复时间戳 */
  lastResumeTime: number | null
  /** 恢复后自动重试次数 */
  resumeRetryCount: number
}

export function useAppResilience() {
  const { state: connectionState, retry: handleConnectionRetry } = useConnectionStatus()
  const { addListener } = useTauriListener()

  const appReady = ref(false)
  const justResumed = ref(false)
  const lastResumeTime = ref<number | null>(null)
  const resumeRetryCount = ref(0)

  /**
   * 注册系统事件监听器
   * - system-resumed：系统从休眠恢复，自动重连
   * - app-state-ready：应用数据已就绪
   */
  const registerResilienceListeners = async () => {
    if (!hasTauriRuntime()) return

    const [{ listen }] = await Promise.all([import('@tauri-apps/api/event')])

    // 监听系统休眠恢复
    addListener(
      listen('system-resumed', () => {
        logger.info('[Resilience] 系统从休眠恢复，触发自动重连')
        justResumed.value = true
        lastResumeTime.value = Date.now()
        resumeRetryCount.value++

        // 延迟 500ms 后重连，给系统网络层恢复时间
        setTimeout(async () => {
          try {
            await handleConnectionRetry()
            logger.info('[Resilience] 休眠恢复后重连成功')
          } catch (e) {
            logger.warn('[Resilience] 休眠恢复后重连失败，将在下次健康探针触发时重试:', e)
          } finally {
            justResumed.value = false
          }
        }, 500)
      }),
      'system-resumed'
    )

    // 监听应用状态就绪
    addListener(
      listen('app-state-ready', () => {
        logger.info('[Resilience] 应用状态就绪')
        appReady.value = true
      }),
      'app-state-ready'
    )
  }

  /**
   * 注册全局未捕获异常处理
   * 注意：Tauri 环境下 JS 崩溃不会导致渲染进程退出，
   * 但捕获后可以记录日志并尝试恢复
   */
  const registerErrorBoundary = () => {
    // 全局 Promise 拒绝处理
    window.addEventListener('unhandledrejection', (event) => {
      logger.error('[Resilience] 未处理的 Promise 拒绝:', event.reason)
      // 阻止默认行为（控制台报错），已由 Logger/ErrorTracker 处理
    })

    // 渲染进程崩溃检测（通过心跳）
    let lastHeartbeat = Date.now()
    const HEARTBEAT_INTERVAL = 10_000 // 每 10 秒检查一次
    const HEARTBEAT_TIMEOUT = 30_000 // 30 秒无响应视为异常

    const heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeat
      if (elapsed > HEARTBEAT_TIMEOUT) {
        logger.error(`[Resilience] 渲染进程可能卡死: ${elapsed}ms 无响应`)
        // 尝试强制刷新页面
        if (import.meta.env.PROD && hasTauriRuntime()) {
          window.location.reload()
        }
      }
      lastHeartbeat = Date.now()
    }, HEARTBEAT_INTERVAL)

    return () => clearInterval(heartbeatTimer)
  }

  /**
   * 主动健康检查：手动触发连接状态检查
   * Rust 端已自动运行后台健康探针，此方法用于前端主动触发重连
   */
  const triggerHealthCheck = async () => {
    if (connectionState.value === 'online') {
      logger.debug('[Resilience] 连接正常，跳过健康检查')
      return
    }
    logger.info('[Resilience] 连接异常，触发主动重连')
    await handleConnectionRetry()
  }

  /**
   * 获取当前韧性状态
   */
  const getResilienceState = (): ResilienceState => ({
    appReady: appReady.value,
    justResumed: justResumed.value,
    lastResumeTime: lastResumeTime.value,
    resumeRetryCount: resumeRetryCount.value
  })

  let cleanupErrorBoundary: (() => void) | null = null

  const init = () => {
    registerResilienceListeners()
    cleanupErrorBoundary = registerErrorBoundary()
    logger.info('[Resilience] 韧性模块已初始化')
  }

  const cleanup = () => {
    cleanupErrorBoundary?.()
    logger.info('[Resilience] 韧性模块已清理')
  }

  return {
    appReady,
    justResumed,
    lastResumeTime,
    resumeRetryCount,
    init,
    cleanup,
    triggerHealthCheck,
    getResilienceState
  }
}
