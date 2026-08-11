import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { normalizeSettingsTab, SETTINGS_TABS, type SettingsTabInput, type SettingsTabType } from './settingsSchema'

export type { SettingsTab, SettingsTabGroup, SettingsTabInput, SettingsTabType } from './settingsSchema'
export {
  getGroupedSettingsTabs,
  getSettingsTabGroupLabel,
  getSettingsTabLabel,
  normalizeSettingsTab,
  SETTINGS_TAB_GROUPS,
  SETTINGS_TABS
} from './settingsSchema'

export const useSettingsDialogStore = defineStore(StoresEnum.SETTINGS_DIALOG, () => {
  const activeTab = ref<SettingsTabType>('account')
  const initialData = ref<Record<string, unknown> | undefined>(undefined)

  const currentTab = computed(() => {
    return SETTINGS_TABS.find((tab) => tab.id === activeTab.value)
  })

  function setActiveTab(tab: SettingsTabInput): void {
    activeTab.value = normalizeSettingsTab(tab) ?? 'account'
  }

  function resetToDefault(): void {
    activeTab.value = 'account'
    initialData.value = undefined
  }

  return {
    activeTab,
    initialData,
    currentTab,
    setActiveTab,
    resetToDefault
  }
})
