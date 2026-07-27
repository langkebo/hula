import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkeletonSettings from '../SkeletonSettings.vue'

describe('SkeletonSettings', () => {
  it('渲染左导航和右表单两栏布局', () => {
    const wrapper = mount(SkeletonSettings)
    expect(wrapper.find('.skeleton-settings__nav').exists()).toBe(true)
    expect(wrapper.find('.skeleton-settings__form').exists()).toBe(true)
  })

  it('左导航渲染指定 navItems 项', () => {
    const wrapper = mount(SkeletonSettings, {
      props: { navItems: 5 }
    })
    expect(wrapper.findAll('.skeleton-settings__nav-item')).toHaveLength(5)
  })

  it('左导航默认 4 项', () => {
    const wrapper = mount(SkeletonSettings)
    expect(wrapper.findAll('.skeleton-settings__nav-item')).toHaveLength(4)
  })

  it('右表单渲染指定 formFields 个字段', () => {
    const wrapper = mount(SkeletonSettings, {
      props: { formFields: 6 }
    })
    expect(wrapper.findAll('.skeleton-settings__field')).toHaveLength(6)
  })

  it('右表单默认 4 个字段', () => {
    const wrapper = mount(SkeletonSettings)
    expect(wrapper.findAll('.skeleton-settings__field')).toHaveLength(4)
  })

  it('每个表单字段包含标签和输入框骨架', () => {
    const wrapper = mount(SkeletonSettings, {
      props: { formFields: 3 }
    })
    const fields = wrapper.findAll('.skeleton-settings__field')
    for (const field of fields) {
      expect(field.find('.skeleton-settings__label').exists()).toBe(true)
      expect(field.find('.skeleton-settings__input').exists()).toBe(true)
    }
  })

  it('容器有可访问性属性 role=status', () => {
    const wrapper = mount(SkeletonSettings)
    expect(wrapper.find('.skeleton-settings').attributes('role')).toBe('status')
  })
})
