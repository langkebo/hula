import { computed } from 'vue'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'

type PrivacyProtectionOptions = {
  onPrivacyChange?: (isPrivate: boolean) => void
}

export function usePrivacyProtection(options?: PrivacyProtectionOptions) {
  const userStore = useUserStore()
  const _settingStore = useSettingStore()

  const isPrivacyMode = computed(() => false)

  const settings = computed(() => ({
    watermarkEnabled: true,
    blurEffect: false,
    blockScreenshot: false
  }))

  const enterPrivateChat = () => {
    options?.onPrivacyChange?.(true)
  }

  const leavePrivateChat = () => {
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
