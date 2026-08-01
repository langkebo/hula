import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { usePluginsListMock } = vi.hoisted(() => ({
  usePluginsListMock: vi.fn()
}))

vi.mock('@/layout/left/config.tsx', () => ({
  usePluginsList: usePluginsListMock
}))

import { PluginEnum } from '@/enums'
import { usePluginsStore } from '../plugins'

const makePlugin = (overrides: Partial<STO.Plugins<PluginEnum>> = {}) =>
  ({
    url: 'roomList',
    icon: 'icon',
    iconAction: 'icon-action',
    state: PluginEnum.BUILTIN,
    isAdd: true,
    dot: false,
    progress: 0,
    miniShow: false,
    title: 'Title',
    shortTitle: 'Short',
    ...overrides
  }) as STO.Plugins<PluginEnum>

describe('usePluginsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    usePluginsListMock.mockReturnValue(
      ref([
        makePlugin({ url: 'roomList', title: 'Room List' }),
        makePlugin({ url: 'space', title: 'Space' }),
        makePlugin({ url: 'external', state: PluginEnum.NOT_INSTALLED, title: 'External' })
      ])
    )
  })

  it('初始化时通过 syncPluginsWithLocale 同步全部插件列表', () => {
    const store = usePluginsStore()
    // syncPluginsWithLocale 会将 usePluginsList 的全部条目同步进 plugins
    expect(store.plugins).toHaveLength(3)
    expect(store.plugins.map((p) => p.url)).toEqual(['roomList', 'space', 'external'])
  })

  it('viewMode 默认为 card', () => {
    const store = usePluginsStore()
    expect(store.viewMode).toBe('card')
  })

  it('addPlugin 添加新插件', () => {
    const store = usePluginsStore()
    const newPlugin = makePlugin({ url: 'newPlugin', title: 'New' })
    store.addPlugin(newPlugin)
    expect(store.plugins).toHaveLength(4)
    expect(store.plugins.map((p) => p.url)).toContain('newPlugin')
  })

  it('addPlugin 对已存在的 url 不重复添加', () => {
    const store = usePluginsStore()
    const before = store.plugins.length
    store.addPlugin(makePlugin({ url: 'roomList', title: 'Duplicate' }))
    expect(store.plugins).toHaveLength(before)
    expect(store.plugins.find((p) => p.url === 'roomList')?.title).toBe('Room List')
  })

  it('removePlugin 按 url 删除插件', () => {
    const store = usePluginsStore()
    store.removePlugin(makePlugin({ url: 'roomList' }))
    expect(store.plugins.map((p) => p.url)).toEqual(['space', 'external'])
  })

  it('removePlugin 对不存在的 url 会因 splice(-1,1) 删除最后一项', () => {
    const store = usePluginsStore()
    expect(store.plugins).toHaveLength(3)
    store.removePlugin(makePlugin({ url: 'notExist' }))
    // splice(-1, 1) 会移除数组最后一项
    expect(store.plugins).toHaveLength(2)
    expect(store.plugins.map((p) => p.url)).toEqual(['roomList', 'space'])
  })

  it('updatePlugin 更新已存在插件的全部字段', () => {
    const store = usePluginsStore()
    const updated = makePlugin({ url: 'roomList', title: 'Updated Title', icon: 'new-icon' })
    store.updatePlugin(updated)
    const plugin = store.plugins.find((p) => p.url === 'roomList')
    expect(plugin?.title).toBe('Updated Title')
    expect(plugin?.icon).toBe('new-icon')
  })

  it('updatePlugin 对不存在的 url 不做修改', () => {
    const store = usePluginsStore()
    const before = store.plugins.find((p) => p.url === 'roomList')
    store.updatePlugin(makePlugin({ url: 'notExist', title: 'X' }))
    expect(store.plugins.find((p) => p.url === 'roomList')).toEqual(before)
    expect(store.plugins.find((p) => p.url === 'notExist')).toBeUndefined()
  })
})
