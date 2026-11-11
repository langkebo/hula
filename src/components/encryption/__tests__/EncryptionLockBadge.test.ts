import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EncryptionLockBadge from '../EncryptionLockBadge.vue'

describe('EncryptionLockBadge', () => {
  it('渲染锁图标与文案', () => {
    const wrapper = mount(EncryptionLockBadge, { props: { label: '已加密' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('已加密')
  })
})
