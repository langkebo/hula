import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingStore } from '../setting'

describe('锁屏状态', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('默认未启用且不携带明文密码字段', () => {
    const store = useSettingStore()

    expect(store.lockScreen).toEqual({ enable: false, passwordHash: '' })
    expect('password' in store.lockScreen).toBe(false)
  })
})
