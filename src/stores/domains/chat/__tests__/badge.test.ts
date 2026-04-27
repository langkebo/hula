import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/matrix', () => ({
  matrixClientService: {
    getClient: () => null
  }
}))

import { buildBadgeCatalog, useBadgeStore } from '../badge'

describe('buildBadgeCatalog', () => {
  it('returns the known catalog entry for id "6"', () => {
    const list = buildBadgeCatalog(['6'])
    expect(list).toEqual([{ id: '6', img: '/hula.png', describe: '频道徽章' }])
  })

  it('synthesizes a generic entry for unknown ids', () => {
    const list = buildBadgeCatalog(['x'])
    expect(list).toEqual([{ id: 'x', img: '/img/dispersion-bg.png', describe: '徽章 x' }])
  })

  it('dedupes ids', () => {
    const list = buildBadgeCatalog(['6', '6', 'x', 'x'])
    expect(list.map((b) => b.id)).toEqual(['6', 'x'])
  })

  it('filters out empty ids', () => {
    const list = buildBadgeCatalog(['', '6'])
    expect(list.map((b) => b.id)).toEqual(['6'])
  })
})

describe('useBadgeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with the known badge catalog', () => {
    const store = useBadgeStore()
    expect(store.badges.map((b) => b.id)).toEqual(['6'])
  })

  it('badgeById returns undefined for empty id', () => {
    const store = useBadgeStore()
    expect(store.badgeById(undefined)).toBeUndefined()
    expect(store.badgeById('')).toBeUndefined()
  })

  it('badgeById returns existing badge', () => {
    const store = useBadgeStore()
    expect(store.badgeById('6')?.img).toBe('/hula.png')
  })

  it('badgeById synthesizes a fallback for unknown ids', () => {
    const store = useBadgeStore()
    const badge = store.badgeById('zz')
    expect(badge).toEqual({ id: 'zz', img: '/img/dispersion-bg.png', describe: '徽章 zz' })
  })

  it('setBadges replaces the list', () => {
    const store = useBadgeStore()
    store.setBadges([{ id: 'a', img: '/a', describe: 'A' }])
    expect(store.badges.map((b) => b.id)).toEqual(['a'])
  })

  it('addBadge appends new badges', () => {
    const store = useBadgeStore()
    store.addBadge({ id: 'a', img: '/a', describe: 'A' })
    expect(store.badges.map((b) => b.id)).toEqual(['6', 'a'])
  })

  it('addBadge ignores duplicates', () => {
    const store = useBadgeStore()
    store.addBadge({ id: '6', img: '/x', describe: 'X' })
    expect(store.badges.map((b) => b.id)).toEqual(['6'])
  })

  it('loadBadges no-ops when matrix client is unavailable', async () => {
    const store = useBadgeStore()
    await store.loadBadges()
    expect(store.badges.map((b) => b.id)).toEqual(['6'])
  })
})
