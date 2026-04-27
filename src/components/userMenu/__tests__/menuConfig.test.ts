import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => `translated:${key}`
    }
  }
}))

import { getFilteredSections } from '../menuConfig'

describe('menuConfig', () => {
  it('translates section titles and item labels', () => {
    const translate = (key: string) => `mock:${key}`
    const sections = getFilteredSections(true, translate)

    expect(sections[0]?.title).toBe('mock:menu.user_menu.sections.quick_actions')
    expect(sections[0]?.items[0]?.label).toBe('mock:menu.user_menu.items.send_message')
    expect(sections.at(-1)?.items.at(-1)?.label).toBe('mock:menu.sign_out')
  })

  it('filters desktop only items on mobile', () => {
    const sections = getFilteredSections(false, (key) => key)
    const settingsSection = sections.find((section) => section.id === 'settings')

    expect(settingsSection?.items.some((item) => item.id === 'link-device')).toBe(false)
  })
})
