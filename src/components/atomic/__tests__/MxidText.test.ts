/**
 * MxidText 单元测试
 *
 * 覆盖：
 * - showFull 开关下的完整 MXID / localpart 渲染
 * - 截断（maxLength）与 title 全量值
 * - **解析口径来自 `@/utils/userIdentity` 单一事实源**：多段 server name、无冒号、
 *   空值等边界与 `toLocalpart` 保持一致（防止组件又退回自行 `split(':')`）
 *
 * 不覆盖：
 * - 视觉样式（字体/颜色）
 * - 交互（本组件为纯展示）
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { toLocalpart } from '@/utils/userIdentity'
import MxidText from '../MxidText.vue'

function mountMxid(mxid: string | null, props: Record<string, unknown> = {}) {
  return mount(MxidText, { props: { mxid, ...props } })
}

describe('MxidText', () => {
  it('默认只显示 localpart', () => {
    const wrapper = mountMxid('@kevins:matrix.test')

    expect(wrapper.text()).toBe('kevins')
    // title 始终给全量值
    expect(wrapper.attributes('title')).toBe('@kevins:matrix.test')
  })

  it('showFull 时显示完整 MXID', () => {
    const wrapper = mountMxid('@kevins:matrix.test', { showFull: true })

    expect(wrapper.text()).toBe('@kevins:matrix.test')
  })

  it('超出 maxLength 时截断并追加省略号', () => {
    const wrapper = mountMxid('@a-very-long-localpart:matrix.test', { maxLength: 10 })

    expect(wrapper.text()).toBe('a-very-lo\u2026')
    expect(wrapper.text()).toHaveLength(10)
  })

  it('多段 server name 只取 localpart', () => {
    const wrapper = mountMxid('@user:server.example.com')

    expect(wrapper.text()).toBe('user')
  })

  it('无冒号的输入按原样显示（无法解析 server name）', () => {
    const wrapper = mountMxid('kevins')

    expect(wrapper.text()).toBe('kevins')
  })

  it('空值渲染为空且不抛错', () => {
    expect(mountMxid(null).text()).toBe('')
    expect(mountMxid('').text()).toBe('')
  })

  it('解析结果与 toLocalpart 单一事实源逐例一致', () => {
    const samples = ['@hulatest:matrix.test', '@u:server.com', 'localonly', '@noServer', '@:matrix.test']

    for (const sample of samples) {
      expect(mountMxid(sample).text()).toBe(toLocalpart(sample))
    }
  })

  it('isMono 时附加等宽类', () => {
    const wrapper = mountMxid('@kevins:matrix.test', { isMono: true })

    expect(wrapper.classes()).toContain('mxid-text--mono')
  })
})
