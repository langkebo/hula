import { describe, expect, it, vi } from 'vitest'
import { createSettingsDirtyRegistry } from '../useSettingsDirtyRegistry'

describe('useSettingsDirtyRegistry', () => {
  it('tracks dirty tabs and clears them on demand', () => {
    const registry = createSettingsDirtyRegistry()

    registry.setTabDirty('account', true)
    registry.setTabDirty('notifications', true)

    expect(registry.hasDirtyTabs.value).toBe(true)
    expect(registry.dirtyTabs.value).toEqual(['account', 'notifications'])

    registry.clearDirtyTabs()
    expect(registry.hasDirtyTabs.value).toBe(false)
    expect(registry.dirtyTabs.value).toEqual([])
  })

  it('only asks for confirmation when switching away from a dirty tab', async () => {
    const confirmHandler = vi.fn().mockResolvedValue(true)
    const registry = createSettingsDirtyRegistry(confirmHandler)

    registry.setTabDirty('account', true)

    await expect(
      registry.confirmIfNeeded({
        scope: 'switch',
        tabId: 'notifications',
        currentTabLabel: '通知设置'
      })
    ).resolves.toBe(true)
    expect(confirmHandler).not.toHaveBeenCalled()

    await expect(
      registry.confirmIfNeeded({
        scope: 'switch',
        tabId: 'account',
        currentTabLabel: '账户'
      })
    ).resolves.toBe(true)
    expect(confirmHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'switch',
        tabId: 'account',
        currentTabLabel: '账户',
        dirtyTabs: ['account']
      })
    )
  })

  it('confirms before closing when any tab has unsaved changes', async () => {
    const confirmHandler = vi.fn().mockResolvedValue(false)
    const registry = createSettingsDirtyRegistry(confirmHandler)

    registry.setTabDirty('account', true)
    registry.setTabDirty('helpAbout', true)

    await expect(
      registry.confirmIfNeeded({
        scope: 'close',
        tabId: 'account',
        currentTabLabel: '账户'
      })
    ).resolves.toBe(false)
    expect(confirmHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'close',
        dirtyTabs: ['account', 'helpAbout']
      })
    )
  })
})
