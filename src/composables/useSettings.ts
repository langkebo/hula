/**
 * 设置相关 Composables
 * 提供设置操作的通用逻辑
 */
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSettings')

export function useSettings() {
  const store = useSettingsStore()
  const isInitialized = ref(false)
  const error = ref<Error | null>(null)

  async function initialize() {
    if (isInitialized.value) return

    try {
      await store.initialize()
      isInitialized.value = true
    } catch (e) {
      error.value = e as Error
      logger.error('Failed to initialize settings:', e)
    }
  }

  onMounted(() => {
    initialize()
  })

  return {
    store,
    isInitialized,
    error,
    initialize
  }
}

export function useProfile() {
  const store = useSettingsStore()
  const isSaving = ref(false)

  const profile = computed(() => store.profile)
  const isLoading = computed(() => store.loading.profile)

  async function updateDisplayName(displayName: string) {
    isSaving.value = true
    try {
      return await store.updateProfile({ displayName })
    } finally {
      isSaving.value = false
    }
  }

  async function updateAvatarUrl(avatarUrl: string | null) {
    isSaving.value = true
    try {
      return await store.updateProfile({ avatarUrl })
    } finally {
      isSaving.value = false
    }
  }

  async function updateAbout(about: string) {
    isSaving.value = true
    try {
      return await store.updateProfile({ about })
    } finally {
      isSaving.value = false
    }
  }

  return {
    profile,
    isLoading,
    isSaving,
    updateDisplayName,
    updateAvatarUrl,
    updateAbout,
    fetch: store.fetchProfile
  }
}

export function useDeviceManagement() {
  const store = useSettingsStore()
  const isOperating = ref(false)

  const devices = computed(() => store.devices)
  const currentDevice = computed(() => store.currentDevice)
  const otherDevices = computed(() => store.otherDevices)
  const isLoading = computed(() => store.loading.devices)

  async function rename(deviceId: string, name: string) {
    isOperating.value = true
    try {
      return await store.renameDevice(deviceId, name)
    } finally {
      isOperating.value = false
    }
  }

  async function remove(deviceId: string) {
    isOperating.value = true
    try {
      return await store.deleteDevice(deviceId)
    } finally {
      isOperating.value = false
    }
  }

  return {
    devices,
    currentDevice,
    otherDevices,
    isLoading,
    isOperating,
    rename,
    remove,
    fetch: store.fetchDevices
  }
}

export function useNotificationSettings() {
  const store = useSettingsStore()

  const pushRules = computed(() => store.pushRules)
  const isLoading = computed(() => store.loading.pushRules)

  async function setRuleEnabled(scope: string, kind: string, ruleId: string, enabled: boolean) {
    return store.setPushRuleEnabled(scope, kind, ruleId, enabled)
  }

  function isRuleEnabled(kind: string, ruleId: string): boolean {
    if (!pushRules.value) return false
    const rules = pushRules.value.global[kind as keyof typeof pushRules.value.global]
    const rule = rules.find((r) => r.ruleId === ruleId)
    return rule?.enabled ?? false
  }

  return {
    pushRules,
    isLoading,
    setRuleEnabled,
    isRuleEnabled,
    fetch: store.fetchPushRules
  }
}

export function usePrivacySettings() {
  const store = useSettingsStore()
  const isSaving = ref(false)

  const settings = computed(() => store.privacySettings)
  const isLoading = computed(() => store.loading.privacy)

  async function update(newSettings: Partial<typeof settings.value>) {
    isSaving.value = true
    try {
      return await store.updatePrivacySettings(newSettings)
    } finally {
      isSaving.value = false
    }
  }

  async function toggleOnlineStatus() {
    return update({ showOnlineStatus: !settings.value.showOnlineStatus })
  }

  async function toggleTypingStatus() {
    return update({ showTypingStatus: !settings.value.showTypingStatus })
  }

  async function toggleReadReceipts() {
    return update({ shareReadReceipts: !settings.value.shareReadReceipts })
  }

  return {
    settings,
    isLoading,
    isSaving,
    update,
    toggleOnlineStatus,
    toggleTypingStatus,
    toggleReadReceipts,
    fetch: store.fetchPrivacySettings
  }
}

export function useIgnoredUsers() {
  const store = useSettingsStore()
  const isOperating = ref(false)

  const users = computed(() => store.ignoredUsers)
  const isLoading = computed(() => store.loading.ignoredUsers)

  async function ignore(userId: string) {
    isOperating.value = true
    try {
      return await store.ignoreUser(userId)
    } finally {
      isOperating.value = false
    }
  }

  async function unignore(userId: string) {
    isOperating.value = true
    try {
      return await store.unignoreUser(userId)
    } finally {
      isOperating.value = false
    }
  }

  function isIgnored(userId: string): boolean {
    return users.value.includes(userId)
  }

  return {
    users,
    isLoading,
    isOperating,
    ignore,
    unignore,
    isIgnored,
    fetch: store.fetchIgnoredUsers
  }
}
