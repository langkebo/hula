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

/**
 * 发送快捷键选项（桌面 / 移动共用）。
 *
 * 标签走 i18n，避免两端各写一份硬编码文案（S9 双端重复实现收敛）。
 */
export function useSendKeyOptions() {
  const { t } = useI18n()
  return computed(() => [
    { label: 'Enter', value: 'Enter' },
    { label: t('setting.preferences.send_key_ctrl_enter'), value: 'Ctrl+Enter' },
    { label: t('setting.preferences.send_key_shift_enter'), value: 'Shift+Enter' }
  ])
}

/** 默认阅后即焚时长选项（桌面 / 移动共用） */
export function useBurnDurationOptions() {
  const { t } = useI18n()
  return computed(() => [
    { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
    { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
    { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
    { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
    { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
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
