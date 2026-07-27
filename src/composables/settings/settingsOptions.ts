import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MacOsKeyEnum, WinKeyEnum } from '@/enums'
import { isWindows } from '@/utils/PlatformConstants'

export function useSendOptions() {
  const { t } = useI18n()
  const modifierKey = computed(() => {
    return `${isWindows() ? WinKeyEnum.CTRL : MacOsKeyEnum['⌘']}`
  })

  return computed(() => [
    {
      label: t('setting.shortcut.send_message_shortcut_option', { key: 'Enter' }),
      value: 'Enter'
    },
    {
      label: t('setting.shortcut.send_message_shortcut_option', { key: modifierKey.value }),
      value: `${modifierKey.value}+Enter`
    }
  ])
}

function _useTranslateOptions() {
  const { t } = useI18n()
  return computed(() => [
    {
      label: t('setting.general.chat.translate_options.tencent'),
      value: 'tencent'
    },
    {
      label: t('setting.general.chat.translate_options.youdao'),
      value: 'youdao'
    }
  ])
}

function _useFontOptions() {
  const { t } = useI18n()
  return computed(() => [
    {
      label: t('setting.general.ui.font_options.PingFang'),
      value: 'PingFang'
    },
    {
      label: t('setting.general.ui.font_options.AliFangYuan'),
      value: 'AliFangYuan'
    }
  ])
}

export function useLanguageOptions() {
  const { t } = useI18n()
  return computed(() => [
    {
      label: t('setting.preferences.language_auto'),
      value: 'AUTO'
    },
    {
      label: t('setting.preferences.language_zh_cn'),
      value: 'zh-CN'
    },
    {
      label: t('setting.preferences.language_zh_tw'),
      value: 'zh-TW'
    },
    {
      label: t('setting.preferences.language_en'),
      value: 'en'
    },
    {
      label: t('setting.preferences.language_ja'),
      value: 'ja'
    }
  ])
}
