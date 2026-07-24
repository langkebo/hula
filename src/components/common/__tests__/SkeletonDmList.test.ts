import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SkeletonDmList from '../SkeletonDmList.vue'

describe('SkeletonDmList', () => {
  it('渲染指定 rows 行骨架项', () => {
    const wrapper = mount(SkeletonDmList, {
      props: { rows: 4 }
    })

    expect(wrapper.findAll('.skeleton-list__row')).toHaveLength(4)
  })

  it('每行包含头像和两行文本（名称 + 消息预览）', () => {
    const wrapper = mount(SkeletonDmList)

    const rows = wrapper.findAll('.skeleton-list__row')
    for (const row of rows) {
      expect(row.find('.skeleton-base--avatar').exists()).toBe(true)
      expect(row.findAll('.skeleton-base--text')).toHaveLength(2)
    }
  })

  it('rows 默认值为 5', () => {
    const wrapper = mount(SkeletonDmList)

    expect(wrapper.findAll('.skeleton-list__row')).toHaveLength(5)
  })
})
