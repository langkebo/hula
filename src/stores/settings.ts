/**
 * 设置 Store
 * 管理用户设置状态
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import matrixSettingsService, {
  type UserProfile,
  type Device,
  type PushRules,
  type PrivacySettings
} from '@/services/matrix/MatrixSettingsService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SettingsStore')

const defaultPrivacySettings: PrivacySettings = {
  showOnlineStatus: true,
  showTypingStatus: true,
  shareReadReceipts: true,
  allowPublicRoomDiscovery: false,
  allow3pidDiscovery: false
}

export const useSettingsStore = defineStore('settings', () => {
  const profile = ref<UserProfile | null>(null)
  const devices = ref<Device[]>([])
  const pushRules = ref<PushRules | null>(null)
  const privacySettings = ref<PrivacySettings>(defaultPrivacySettings)
  const ignoredUsers = ref<string[]>([])
  const loading = ref({
    profile: false,
    devices: false,
    pushRules: false,
    privacy: false,
    ignoredUsers: false
  })

  const currentDevice = computed(() => {
    return devices.value.find((d) => d.isCurrentDevice)
  })

  const otherDevices = computed(() => {
    return devices.value.filter((d) => !d.isCurrentDevice)
  })

  async function fetchProfile() {
    loading.value.profile = true
    try {
      profile.value = await matrixSettingsService.getProfile()
    } catch (error) {
      logger.error('Failed to fetch profile:', error)
    } finally {
      loading.value.profile = false
    }
  }

  async function updateProfile(data: Partial<UserProfile>) {
    loading.value.profile = true
    try {
      const success = await matrixSettingsService.updateProfile(data)
      if (success) {
        profile.value = { ...profile.value, ...data } as UserProfile
      }
      return success
    } catch (error) {
      logger.error('Failed to update profile:', error)
      return false
    } finally {
      loading.value.profile = false
    }
  }

  async function fetchDevices() {
    loading.value.devices = true
    try {
      devices.value = await matrixSettingsService.getDevices()
    } catch (error) {
      logger.error('Failed to fetch devices:', error)
    } finally {
      loading.value.devices = false
    }
  }

  async function renameDevice(deviceId: string, name: string) {
    try {
      const success = await matrixSettingsService.updateDevice(deviceId, name)
      if (success) {
        const device = devices.value.find((d) => d.deviceId === deviceId)
        if (device) {
          device.displayName = name
        }
      }
      return success
    } catch (error) {
      logger.error('Failed to rename device:', error)
      return false
    }
  }

  async function deleteDevice(deviceId: string) {
    try {
      const success = await matrixSettingsService.deleteDevice(deviceId)
      if (success) {
        devices.value = devices.value.filter((d) => d.deviceId !== deviceId)
      }
      return success
    } catch (error) {
      logger.error('Failed to delete device:', error)
      return false
    }
  }

  async function fetchPushRules() {
    loading.value.pushRules = true
    try {
      pushRules.value = await matrixSettingsService.getPushRules()
    } catch (error) {
      logger.error('Failed to fetch push rules:', error)
    } finally {
      loading.value.pushRules = false
    }
  }

  async function setPushRuleEnabled(scope: string, kind: string, ruleId: string, enabled: boolean) {
    try {
      const success = await matrixSettingsService.setPushRuleEnabled(scope, kind, ruleId, enabled)
      if (success && pushRules.value) {
        const rules = pushRules.value.global[kind as keyof typeof pushRules.value.global]
        const rule = rules.find((r) => r.ruleId === ruleId)
        if (rule) {
          rule.enabled = enabled
        }
      }
      return success
    } catch (error) {
      logger.error('Failed to set push rule enabled:', error)
      return false
    }
  }

  async function fetchPrivacySettings() {
    loading.value.privacy = true
    try {
      privacySettings.value = await matrixSettingsService.getPrivacySettings()
    } catch (error) {
      logger.error('Failed to fetch privacy settings:', error)
    } finally {
      loading.value.privacy = false
    }
  }

  async function updatePrivacySettings(settings: Partial<PrivacySettings>) {
    loading.value.privacy = true
    try {
      const success = await matrixSettingsService.setPrivacySettings(settings)
      if (success) {
        privacySettings.value = { ...privacySettings.value, ...settings }
      }
      return success
    } catch (error) {
      logger.error('Failed to update privacy settings:', error)
      return false
    } finally {
      loading.value.privacy = false
    }
  }

  async function fetchIgnoredUsers() {
    loading.value.ignoredUsers = true
    try {
      ignoredUsers.value = await matrixSettingsService.getIgnoredUsers()
    } catch (error) {
      logger.error('Failed to fetch ignored users:', error)
    } finally {
      loading.value.ignoredUsers = false
    }
  }

  async function ignoreUser(userId: string) {
    try {
      const success = await matrixSettingsService.ignoreUser(userId)
      if (success && !ignoredUsers.value.includes(userId)) {
        ignoredUsers.value.push(userId)
      }
      return success
    } catch (error) {
      logger.error('Failed to ignore user:', error)
      return false
    }
  }

  async function unignoreUser(userId: string) {
    try {
      const success = await matrixSettingsService.unignoreUser(userId)
      if (success) {
        ignoredUsers.value = ignoredUsers.value.filter((id) => id !== userId)
      }
      return success
    } catch (error) {
      logger.error('Failed to unignore user:', error)
      return false
    }
  }

  async function initialize() {
    await Promise.all([fetchProfile(), fetchDevices(), fetchPushRules(), fetchPrivacySettings(), fetchIgnoredUsers()])
  }

  function reset() {
    profile.value = null
    devices.value = []
    pushRules.value = null
    privacySettings.value = defaultPrivacySettings
    ignoredUsers.value = []
  }

  return {
    profile,
    devices,
    pushRules,
    privacySettings,
    ignoredUsers,
    loading,
    currentDevice,
    otherDevices,
    fetchProfile,
    updateProfile,
    fetchDevices,
    renameDevice,
    deleteDevice,
    fetchPushRules,
    setPushRuleEnabled,
    fetchPrivacySettings,
    updatePrivacySettings,
    fetchIgnoredUsers,
    ignoreUser,
    unignoreUser,
    initialize,
    reset
  }
})
