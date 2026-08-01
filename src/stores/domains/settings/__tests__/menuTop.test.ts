import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => `T:${key}`
    })
  }
})

import { PluginEnum } from '@/enums'
import { useMenuTopStore } from '../menuTop'

describe('useMenuTopStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('menuTop 包含两个内置项（message 与 friendsList）', () => {
    const store = useMenuTopStore()
    expect(store.menuTop).toHaveLength(2)
    expect(store.menuTop.map((item) => item.url)).toEqual(['message', 'friendsList'])
  })

  it('每项都使用 BUILTIN 状态且 isAdd=true', () => {
    const store = useMenuTopStore()
    for (const item of store.menuTop) {
      expect(item.state).toBe(PluginEnum.BUILTIN)
      expect(item.isAdd).toBe(true)
    }
  })

  it('message 项保留 icon / iconAction 字段并通过 i18n 注入标题', () => {
    const store = useMenuTopStore()
    const message = store.menuTop.find((item) => item.url === 'message')
    expect(message).toBeDefined()
    expect(message?.icon).toBe('message')
    expect(message?.iconAction).toBe('message-action')
    expect(message?.title).toBe('T:home.action.message')
    expect(message?.shortTitle).toBe('T:home.action.message_short_title')
  })

  it('friendsList 项保留 icon / iconAction 字段并通过 i18n 注入标题', () => {
    const store = useMenuTopStore()
    const friends = store.menuTop.find((item) => item.url === 'friendsList')
    expect(friends).toBeDefined()
    expect(friends?.icon).toBe('avatar')
    expect(friends?.iconAction).toBe('avatar-action')
    expect(friends?.title).toBe('T:home.action.contact')
    expect(friends?.shortTitle).toBe('T:home.action.contact_short_title')
  })

  it('每项均带 dot=false / progress=0 / miniShow=false 的默认值', () => {
    const store = useMenuTopStore()
    for (const item of store.menuTop) {
      expect(item.dot).toBe(false)
      expect(item.progress).toBe(0)
      expect(item.miniShow).toBe(false)
    }
  })
})
