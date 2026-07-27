/**
 * §9.3.4 离线检测增强 — 心跳探测
 *
 * 通过定期 ping `/_matrix/client/versions` 验证服务器真实可达性，
 * 弥补 `navigator.onLine` 无法识别 DNS/CORS/服务端故障的盲点。
 *
 * 真实在线状态 = navigator.onLine && heartbeatOk
 *
 * 独立于 useNetworkStatus，避免影响现有 WS 状态判断；调用方可组合两者。
 */

import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Heartbeat')

/** 心跳探测依赖（注入便于测试） */
export interface HeartbeatDeps {
  /** 执行 ping 探测，返回是否可达 */
  ping: () => Promise<boolean>
}

interface UseHeartbeatOptions {
  /** 心跳间隔，默认 30000ms */
  intervalMs?: number
  /** 浏览器在线状态（navigator.onLine），默认实时读取 */
  browserOnline?: boolean
}

/**
 * 心跳探测 composable
 *
 * - `heartbeatOk`：null=未知，true=可达，false=不可达
 * - `isReachable`：真实在线状态 = browserOnline && heartbeatOk
 * - `start()`：启动定时心跳（首次立即探测）
 * - `stop()`：停止心跳
 * - `checkNow()`：立即执行一次探测
 */
export function useHeartbeat(deps: HeartbeatDeps, options: UseHeartbeatOptions = {}) {
  const intervalMs = options.intervalMs ?? 30000
  const browserOnlineRef = ref(options.browserOnline ?? (typeof navigator !== 'undefined' ? navigator.onLine : true))

  const heartbeatOk = ref<boolean | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  const isReachable = computed<boolean | null>(() => {
    if (heartbeatOk.value === null) return null
    return browserOnlineRef.value && heartbeatOk.value
  })

  const checkNow = async (): Promise<void> => {
    try {
      const ok = await deps.ping()
      heartbeatOk.value = ok
    } catch (err) {
      logger.warn('心跳探测异常', err)
      heartbeatOk.value = false
    }
  }

  const start = (): void => {
    if (timer !== null) return
    // 首次立即探测
    void checkNow()
    timer = setInterval(() => {
      void checkNow()
    }, intervalMs)
  }

  const stop = (): void => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  tryOnScopeDispose(() => {
    stop()
  })

  return {
    heartbeatOk,
    isReachable,
    start,
    stop,
    checkNow
  }
}
