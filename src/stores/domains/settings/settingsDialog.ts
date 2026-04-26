import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'
import { SETTINGS_TABS, normalizeSettingsTab, type SettingsTabInput, type SettingsTabType } from './settingsSchema'

export { SETTINGS_TABS, normalizeSettingsTab } from './settingsSchema'
export type { LegacySettingsTabType, SettingsTab, SettingsTabInput, SettingsTabType } from './settingsSchema'

export const useSettingsDialogStore = defineStore(StoresEnum.SETTINGS_DIALOG, () => {
  const isOpen = ref(false)
  const activeTab = ref<SettingsTabType>('account')
  const initialData = ref<Record<string, unknown> | undefined>(undefined)

  const currentTab = computed(() => {
    return SETTINGS_TABS.find((tab) => tab.id === activeTab.value)
  })

  function openDialog(tab?: SettingsTabInput, data?: Record<string, unknown>): void {
    const normalizedTab = normalizeSettingsTab(tab)
    if (normalizedTab) {
      activeTab.value = normalizedTab
    }
    initialData.value = data
    isOpen.value = true
  }

  function closeDialog(): void {
    isOpen.value = false
    initialData.value = undefined
  }

  function setActiveTab(tab: SettingsTabInput): void {
    activeTab.value = normalizeSettingsTab(tab) ?? 'account'
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
