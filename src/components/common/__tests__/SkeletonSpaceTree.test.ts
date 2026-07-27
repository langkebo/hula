import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkeletonSpaceTree from '../SkeletonSpaceTree.vue'

describe('SkeletonSpaceTree', () => {
  it('渲染指定 rows 行骨架项', () => {
    const wrapper = mount(SkeletonSpaceTree, {
      props: { rows: 5 }
    })
    expect(wrapper.findAll('.skeleton-space-tree__row')).toHaveLength(5)
  })

  it('rows 默认值为 4', () => {
    const wrapper = mount(SkeletonSpaceTree)
    expect(wrapper.findAll('.skeleton-space-tree__row')).toHaveLength(4)
  })

  it('每行包含图标和文本', () => {
    const wrapper = mount(SkeletonSpaceTree, {
      props: { rows: 3 }
    })
    const rows = wrapper.findAll('.skeleton-space-tree__row')
    for (const row of rows) {
      expect(row.find('.skeleton-base--rect').exists()).toBe(true)
      expect(row.find('.skeleton-base--text').exists()).toBe(true)
    }
  })

  it('不同层级行有递增的缩进', () => {
    const wrapper = mount(SkeletonSpaceTree, {
      props: { rows: 4 }
    })
    const rows = wrapper.findAll('.skeleton-space-tree__row')
    // 行 0 和 1 是 level 0，行 2 和 3 是 level 1
    const level0 = rows[0].classes()
    const level1 = rows[2].classes()
    expect(level0).toContain('skeleton-space-tree__row--level-0')
    expect(level1).toContain('skeleton-space-tree__row--level-1')
  })

  it('容器有可访问性属性 role=status', () => {
    const wrapper = mount(SkeletonSpaceTree)
    expect(wrapper.find('.skeleton-space-tree').attributes('role')).toBe('status')
  })
})
