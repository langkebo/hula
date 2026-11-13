import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { resolveOptionLabel, type SettingOption, useSettingPicker } from '../settingsOptions'

const options = computed<SettingOption<string>[]>(() => [
  { label: 'Enter', value: 'Enter' },
  { label: 'Ctrl + Enter', value: 'Ctrl+Enter' }
])

describe('resolveOptionLabel', () => {
  it('returns the label of the matching option', () => {
    expect(resolveOptionLabel(options.value, 'Ctrl+Enter')).toBe('Ctrl + Enter')
  })

  it('falls back to the raw value when no option matches', () => {
    expect(resolveOptionLabel(options.value, 'Shift+Enter')).toBe('Shift+Enter')
  })
})

describe('useSettingPicker', () => {
  it('exposes picker columns and the current label', () => {
    const model = ref('Enter')
    const picker = useSettingPicker(options, model)

    expect(picker.columns.map((column) => column.text)).toEqual(['Enter', 'Ctrl + Enter'])
    expect(picker.label).toBe('Enter')
  })

  it('writes the selected value back to the model and closes the picker', () => {
    const model = ref('Enter')
    const picker = useSettingPicker(options, model)
    picker.show = true

    picker.confirm({ selectedValues: ['Ctrl+Enter'] })

    expect(model.value).toBe('Ctrl+Enter')
    expect(picker.label).toBe('Ctrl + Enter')
    expect(picker.show).toBe(false)
  })
})
