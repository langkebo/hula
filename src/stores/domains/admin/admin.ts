import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { adminService } from '@/services/matrix'
import { useMatrixStore } from '../chat/matrix'
import { TauriCommand } from '@/enums'
import { createLogger } from '@/utils/Logger'

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

  const canAccessAdmin = computed(() => isAdmin.value && matrixStore.isLoggedIn)

  async function checkAdminViaBackend(): Promise<boolean> {
    try {
      const userId = matrixStore.userId
      const accessToken = matrixStore.accessToken

      if (!userId || !accessToken) {
        logger.warn('后端验证: 缺少 userId 或 accessToken')
        return false
      }

      const result = await invoke<AdminCheckResult>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken
      })

      logger.info(`后端管理员验证: userId=${result.user_id}, isAdmin=${result.is_admin}`)
      return result.is_admin
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
      return false
    }

    const now = Date.now()
    if (now - lastCheckedAt.value < ADMIN_CHECK_INTERVAL && !isCheckingAdmin.value) {
      return isAdmin.value
    }

    isCheckingAdmin.value = true
    try {
      const backendResult = await checkAdminViaBackend()
      const frontendResult = await checkAdminViaFrontend()

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
      return false
    } finally {
      isCheckingAdmin.value = false
    }
  }

  async function verifyAdminAccess(): Promise<boolean> {
    const result = await checkAdminStatus()
    return result
  }

  function clearAdminState() {
    isAdmin.value = false
    lastCheckedAt.value = 0
  }

  return {
    isAdmin,
    isCheckingAdmin,
    canAccessAdmin,
    checkAdminStatus,
    verifyAdminAccess,
    clearAdminState
  }
})
