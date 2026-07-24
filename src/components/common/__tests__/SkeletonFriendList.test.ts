import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkeletonFriendList from '../SkeletonFriendList.vue'

describe('SkeletonFriendList', () => {
  it('渲染指定 rows 行骨架项', () => {
    const wrapper = mount(SkeletonFriendList, {
      props: { rows: 5 }
    })

    expect(wrapper.findAll('.skeleton-list__row')).toHaveLength(5)
  })

  it('每行包含头像和两行文本', () => {
    const wrapper = mount(SkeletonFriendList, {
      props: { rows: 3 }
    })

    const rows = wrapper.findAll('.skeleton-list__row')
    for (const row of rows) {
      expect(row.find('.skeleton-base--avatar').exists()).toBe(true)
      expect(row.findAll('.skeleton-base--text')).toHaveLength(2)
    }
  })

  it('rows 默认值为 3', () => {
    const wrapper = mount(SkeletonFriendList)

    expect(wrapper.findAll('.skeleton-list__row')).toHaveLength(3)
  })

  it('容器有可访问性属性 role=status', () => {
    const wrapper = mount(SkeletonFriendList)

    expect(wrapper.find('.skeleton-list').attributes('role')).toBe('status')
  })
})
