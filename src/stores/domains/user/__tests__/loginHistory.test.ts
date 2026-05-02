import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { UserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '../loginHistory'

const make = (account: string, name?: string): UserInfoType =>
  ({
    uid: account,
    account,
    email: `${account}@example.com`,
    avatar: '',
    name: name ?? account,
    modifyNameChance: 0,
    sex: 1 as UserInfoType['sex']
  }) as unknown as UserInfoType

describe('useLoginHistoriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts empty', () => {
    const store = useLoginHistoriesStore()
    expect(store.loginHistories).toEqual([])
  })

  it('addLoginHistory prepends a new account', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a'))
    store.addLoginHistory(make('b'))
    expect(store.loginHistories.map((h) => h.account)).toEqual(['b', 'a'])
  })

  it('addLoginHistory moves an existing account to the front', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a'))
    store.addLoginHistory(make('b'))
    store.addLoginHistory(make('a', 'A2'))
    expect(store.loginHistories.map((h) => h.account)).toEqual(['a', 'b'])
    expect(store.loginHistories[0].name).toBe('A2')
  })

  it('updateLoginHistory replaces by account when present', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a', 'old'))
    store.updateLoginHistory(make('a', 'new'))
    expect(store.loginHistories[0].name).toBe('new')
  })

  it('updateLoginHistory is a no-op for unknown account', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a'))
    store.updateLoginHistory(make('z', 'new'))
    expect(store.loginHistories.map((h) => h.account)).toEqual(['a'])
  })

  it('removeLoginHistory removes by account', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a'))
    store.addLoginHistory(make('b'))
    store.removeLoginHistory(make('a'))
    expect(store.loginHistories.map((h) => h.account)).toEqual(['b'])
  })

  it('removeLoginHistory is a no-op for unknown account', () => {
    const store = useLoginHistoriesStore()
    store.addLoginHistory(make('a'))
    store.removeLoginHistory(make('z'))
    expect(store.loginHistories.map((h) => h.account)).toEqual(['a'])
  })
})
