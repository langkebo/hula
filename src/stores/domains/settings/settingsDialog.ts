import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'

export type SettingsTabType =
  | 'account'
  | 'sessions'
  | 'appearance'
  | 'notifications'
  | 'push'
  | 'preferences'
  | 'keyboard'
  | 'sidebar'
  | 'security'
  | 'encryption'
  | 'voiceVideo'
  | 'integrations'
  | 'labs'
  | 'mjolnir'
  | 'friends'
  | 'burnAfterRead'
  | 'help'

export interface SettingsTab {
  id: SettingsTabType
  label: string
  icon: string
  desktopOnly?: boolean
  mobileOnly?: boolean
}

export const SETTINGS_TABS: SettingsTab[] = [
  { id: 'account', label: '账户', icon: 'user' },
  { id: 'sessions', label: '会话管理', icon: 'devices' },
  { id: 'appearance', label: '外观', icon: 'palette' },
  { id: 'notifications', label: '通知', icon: 'bell' },
  { id: 'push', label: '推送设置', icon: 'bell-ring' },
  { id: 'voiceVideo', label: '语音视频', icon: 'microphone' },
  { id: 'integrations', label: '集成管理', icon: 'puzzle' },
  { id: 'preferences', label: '偏好设置', icon: 'settings' },
  { id: 'keyboard', label: '快捷键', icon: 'keyboard', desktopOnly: true },
  { id: 'sidebar', label: '侧边栏', icon: 'sidebar', desktopOnly: true },
  { id: 'security', label: '安全隐私', icon: 'shield' },
  { id: 'encryption', label: '加密', icon: 'key' },
  { id: 'labs', label: 'Labs', icon: 'flask' },
  { id: 'mjolnir', label: '屏蔽管理', icon: 'block-helper' },
  { id: 'friends', label: '好友管理', icon: 'account-group' },
  { id: 'burnAfterRead', label: '阅后即焚', icon: 'timer-outline' },
  { id: 'help', label: '帮助关于', icon: 'help-circle' }
]

export const useSettingsDialogStore = defineStore(StoresEnum.SETTINGS_DIALOG, () => {
  const isOpen = ref(false)
  const activeTab = ref<SettingsTabType>('account')
  const initialData = ref<Record<string, unknown> | undefined>(undefined)

  const currentTab = computed(() => {
    return SETTINGS_TABS.find((tab) => tab.id === activeTab.value)
  })

  function openDialog(tab?: SettingsTabType, data?: Record<string, unknown>): void {
    if (tab) {
      activeTab.value = tab
    }
    initialData.value = data
    isOpen.value = true
  }

  function closeDialog(): void {
    isOpen.value = false
    initialData.value = undefined
  }

  function setActiveTab(tab: SettingsTabType): void {
    activeTab.value = tab
  }

  function resetToDefault(): void {
    activeTab.value = 'account'
    initialData.value = undefined
  }

  return {
    isOpen,
    activeTab,
    initialData,
    currentTab,
    openDialog,
    closeDialog,
    setActiveTab,
    resetToDefault
  }
})

export type SettingsDialogStore = ReturnType<typeof useSettingsDialogStore>
