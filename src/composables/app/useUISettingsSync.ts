import { watch } from 'vue'
import { loadLanguage } from '@/services/i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { isMobile } from '@/utils/PlatformConstants'

export function useUISettingsSync() {
  const settingStore = useSettingStore()

  watch(
    () => settingStore.pageShadowEnabled,
    (val) => {
      if (isMobile()) {
        document.documentElement.style.setProperty('--shadow-enabled', '1')
      } else {
        document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
      }
    },
    { immediate: true }
  )

  watch(
    () => settingStore.pageBlurEnabled,
    (val) => {
      document.documentElement.setAttribute('data-blur', val ? '1' : '0')
    },
    { immediate: true }
  )

  watch(
    () => settingStore.pageFontFamily,
    (val) => {
      document.documentElement.style.setProperty('--font-family', val)
    },
    { immediate: true }
  )

  watch(
    () => settingStore.languagePreference,
    (lang) => {
      void loadLanguage(lang)
    }
  )
}
