import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { TauriCommand } from '@/enums'
import { adminService } from '@/services/matrix/admin'
import type { AdminApiAvailability } from '@/services/matrix/admin/adminApiAvailability'
import { describeAdminApiAvailability } from '@/services/matrix/admin/adminApiAvailability'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'
import { useMatrixStore } from '../chat/matrix'

const logger = createLogger('AdminStore')

interface AdminCheckResult {
  is_admin: boolean
  user_id: string
}

export const useAdminStore = defineStore('admin', () => {
  const matrixStore = useMatrixStore()

  const isAdmin = ref(false)
  const isCheckingAdmin = ref(false)
  const lastCheckedAt = ref<number>(0)
  const ADMIN_CHECK_INTERVAL = 5 * 60 * 1000

  /** 最近一次 Admin API 探测结果（五态），供后台导航与入口判定使用 */
  const apiAvailability = ref<AdminApiAvailability | null>(null)
  /** 是否已完成过至少一次探测；与 `apiAvailability === null`（探测失败）区分 */
  const availabilityLoaded = ref(false)

  const canAccessAdmin = computed(() => isAdmin.value && matrixStore.isLoggedIn)

  /**
   * 是否展示后台入口。
   * `unsupported`（该 homeserver 没有 Admin API）时隐藏；`unavailable` 保留入口，
   * 以便用户进入后台后触发「重试探测」。
   */
  const canShowAdminEntry = computed(() => canAccessAdmin.value && apiAvailability.value?.status !== 'unsupported')

  async function probeApiAvailability(): Promise<AdminApiAvailability> {
    const availability = await adminService.apiProbe.probe()
    apiAvailability.value = availability
    availabilityLoaded.value = true
    return availability
  }

  async function checkAdminViaBackend(availability: AdminApiAvailability): Promise<boolean> {
    try {
      if (availability.status !== 'available') {
        // 按分类如实报告：403（无权限）**不是**"后端不可用"，
        // 404 是"该 homeserver 没有 Admin API"，只有网络/5xx 才是无法判定。
        const detail = describeAdminApiAvailability(availability)
        if (availability.status === 'forbidden' || availability.status === 'unauthorized') {
          logger.info(`无法通过 Admin API 验证管理员身份：${detail}`)
        } else {
          logger.warn(`无法通过 Admin API 验证管理员身份：${detail}`)
        }
        return false
      }

      const userId = matrixStore.userId
      const accessToken = matrixStore.getAccessToken()

      if (!userId || !accessToken) {
        logger.warn('后端验证: 缺少 userId 或 accessToken')
        return false
      }

      const result = await invokeWithResult<AdminCheckResult>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken,
        homeserverUrl: matrixStore.homeserverUrl
      })

      if (result.isErr()) {
        logger.error(`后端管理员验证失败: ${result.error}`)
        return false
      }

      logger.info(`后端管理员验证: userId=${result.value.user_id}, isAdmin=${result.value.is_admin}`)
      return result.value.is_admin
    } catch (err) {
      logger.error(`后端管理员验证失败: ${err}`)
      return false
    }
  }

  async function checkAdminViaFrontend(): Promise<boolean> {
    try {
      const userId = matrixStore.userId
      if (!userId) {
        return false
      }

      const userInfo = await adminService.getUser(userId)
      return userInfo?.admin === true
    } catch (err) {
      logger.error(`前端管理员验证失败: ${err}`)
      return false
    }
  }

  async function checkAdminStatus(): Promise<boolean> {
    if (!matrixStore.isLoggedIn) {
      isAdmin.value = false
      apiAvailability.value = null
      availabilityLoaded.value = false
      return false
    }

    // 客户端尚未初始化时（启动早期竞态），延迟验证，
    // 避免 "客户端未初始化" 错误产生误导性 ERROR 日志和前后端不一致误报。
    if (!matrixStore.isInitialized) {
      logger.debug('管理员状态检查: 客户端尚未初始化，跳过本次检查')
      return isAdmin.value
    }

    const now = Date.now()
    if (now - lastCheckedAt.value < ADMIN_CHECK_INTERVAL && !isCheckingAdmin.value) {
      return isAdmin.value
    }

    isCheckingAdmin.value = true
    try {
      // 先探测一次，五态结果供导航与入口使用；后端校验复用同一结果，避免重复请求
      const availability = await probeApiAvailability()
      const frontendResult = await checkAdminViaFrontend()

      // 浏览器 dev 模式（无 Tauri runtime）下跳过后端校验，仅依赖前端校验
      if (!hasTauriRuntime()) {
        isAdmin.value = frontendResult
        lastCheckedAt.value = Date.now()
        logger.info(`管理员状态检查(浏览器模式): userId=${matrixStore.userId}, isAdmin=${isAdmin.value}`)
        return isAdmin.value
      }

      const backendResult = await checkAdminViaBackend(availability)

      isAdmin.value = backendResult && frontendResult

      if (backendResult !== frontendResult) {
        logger.warn(`前后端管理员验证结果不一致: backend=${backendResult}, frontend=${frontendResult}`)
        isAdmin.value = false
      }

      lastCheckedAt.value = Date.now()
      logger.info(`管理员状态检查: userId=${matrixStore.userId}, isAdmin=${isAdmin.value}`)
      return isAdmin.value
    } catch (err) {
      logger.error(`管理员状态检查失败: ${err}`)
      isAdmin.value = false
      // 避免探测异常把导航永久卡在 loading
      availabilityLoaded.value = true
      return false
    } finally {
      isCheckingAdmin.value = false
    }
  }

  /** 清空检查缓存并重新探测（后台「重试探测」按钮使用） */
  async function retryApiProbe(): Promise<boolean> {
    lastCheckedAt.value = 0
    return checkAdminStatus()
  }

  async function verifyAdminAccess(): Promise<boolean> {
    const result = await checkAdminStatus()
    return result
  }

  function clearAdminState() {
    isAdmin.value = false
    lastCheckedAt.value = 0
    apiAvailability.value = null
    availabilityLoaded.value = false
  }

  return {
    isAdmin,
    isCheckingAdmin,
    canAccessAdmin,
    canShowAdminEntry,
    apiAvailability,
    availabilityLoaded,
    checkAdminStatus,
    retryApiProbe,
    verifyAdminAccess,
    clearAdminState
  }
})
