import { type ComputedRef, computed, type Ref, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { MacOsKeyEnum, WinKeyEnum } from '@/enums'
import { isWindows } from '@/utils/PlatformConstants'

export interface SettingOption<T extends string | number> {
  label: string
  value: T
}

/** 在选项列表中解析当前值对应的文案；未命中时回退为原始值，避免两端各写一套 fallback */
export function resolveOptionLabel<T extends string | number>(
  options: ReadonlyArray<SettingOption<T>>,
  value: T
): string {
  return options.find((option) => option.value === value)?.label ?? String(value)
}

/**
 * 选项型设置（发送键 / 焚毁时长 / 撤回时限 / 表情大小）的 picker 状态。
 *
 * 移动端直接绑定 `van-popup` 的 `show` / `van-picker` 的 `columns` / `confirm`；
 * 桌面端用 `n-select`，只复用 `resolveOptionLabel` 解析反馈文案。
 * 返回 `reactive` 包装，模板里可直接读写嵌套的 `show` 与 `label`。
 */
export function useSettingPicker<T extends string | number>(options: ComputedRef<SettingOption<T>[]>, model: Ref<T>) {
  const show = ref(false)
  const columns = computed(() => options.value.map((option) => ({ text: option.label, value: option.value })))
  const label = computed(() => resolveOptionLabel(options.value, model.value))

  function confirm({ selectedValues }: { selectedValues: T[] }) {
    const value = selectedValues[0]
    if (value !== undefined) {
      model.value = value
    }
    show.value = false
  }

  return reactive({ show, columns, label, confirm })
}

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
    { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
    { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
    { label: t('setting.burn_after_read.durations.30_minutes'), value: 1800 }
  ])
}

/** 消息撤回时限选项（桌面 / 移动共用，单位秒） */
export function useRecallTimeOptions() {
  const { t } = useI18n()
  return computed(() => [
    { label: t('setting.preferences.recall_2_minutes'), value: 120 },
    { label: t('setting.preferences.recall_5_minutes'), value: 300 },
    { label: t('setting.preferences.recall_10_minutes'), value: 600 }
  ])
}

/** 表情显示大小选项（桌面 / 移动共用） */
export function useEmojiSizeOptions() {
  const { t } = useI18n()
  return computed(() => [
    { label: t('setting.preferences.emoji_small'), value: 'small' },
    { label: t('setting.preferences.emoji_medium'), value: 'medium' },
    { label: t('setting.preferences.emoji_large'), value: 'large' }
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
