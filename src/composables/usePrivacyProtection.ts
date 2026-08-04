import { computed, ref } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'

type PrivacyProtectionOptions = {
  onPrivacyChange?: (isPrivate: boolean) => void
}

export function usePrivacyProtection(options?: PrivacyProtectionOptions) {
  const userStore = useUserStore()
  const _settingStore = useSettingStore()

  const isPrivacyMode = ref(false)

  const settings = computed(() => ({
    watermarkEnabled: isPrivacyMode.value,
    blurEffect: false,
    blockScreenshot: isPrivacyMode.value
  }))

  const enterPrivateChat = () => {
    isPrivacyMode.value = true
    options?.onPrivacyChange?.(true)
  }

  const leavePrivateChat = () => {
    isPrivacyMode.value = false
    options?.onPrivacyChange?.(false)
  }

  const generateWatermark = () => {
    const userName = userStore.userInfo?.name ?? ''
    const userId = userStore.userInfo?.uid ?? ''
    const timestamp = new Date().toLocaleString()
    return `${userName}(${userId}) ${timestamp}`
  }

  return {
    isPrivacyMode,
    settings,
    enterPrivateChat,
    leavePrivateChat,
    generateWatermark
  }
}
