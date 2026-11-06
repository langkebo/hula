import { afterEach, describe, expect, it } from 'vitest'
import { SESSION_LIST_SCROLL_SELECTOR, useSessionListScrollMemory } from '../useSessionListScrollMemory'

/**
 * 会话列表滚动位置记忆。
 *
 * 覆盖「进入会话 → 返回列表」的体感：tab 布局会整体卸载（keep-alive 只覆盖同一
 * router-view 内的同级页面），列表重建后必须回到原位置。
 */
describe('useSessionListScrollMemory', () => {
  const { remember, restore, reset, getRemembered } = useSessionListScrollMemory()

  afterEach(() => {
    reset()
    document.body.innerHTML = ''
  })

  it('remember 后 restore 能把 scrollTop 写回容器', () => {
    const container = document.createElement('div')
    classList(container)
    makeScrollable(container)
    document.body.appendChild(container)

    remember(240)
    expect(getRemembered()).toBe(240)

    expect(restore()).toBe(true)
    expect(container.scrollTop).toBe(240)
  })

  it('没有记录时不恢复（首次进入不应影响滚动）', () => {
    const container = document.createElement('div')
    classList(container)
    document.body.appendChild(container)

    expect(restore()).toBe(false)
    expect(container.scrollTop).toBe(0)
  })

  it('容器尚未渲染时返回 false，不抛错（首屏数据未到时的一次尝试）', () => {
    remember(120)
    expect(restore()).toBe(false)
  })

  it('显式传容器时优先用它（避免全局选择器歧义）', () => {
    const scoped = document.createElement('div')
    makeScrollable(scoped)
    document.body.appendChild(scoped)
    // 同时存在一个「看起来正确」的全局容器，验证不会被误用
    const decoy = document.createElement('div')
    classList(decoy)
    makeScrollable(decoy)
    document.body.appendChild(decoy)

    remember(56)
    expect(restore(scoped)).toBe(true)
    expect(scoped.scrollTop).toBe(56)
    expect(decoy.scrollTop).toBe(0)
  })

  it('容器还不可滚时返回 false，且不写入无效值（虚拟列表刚挂载）', () => {
    const container = document.createElement('div')
    classList(container)
    document.body.appendChild(container)

    // happy-dom 不做布局：scrollHeight 与 clientHeight 都是 0 ⇒ 可滚距离 0 < 记录值
    remember(240)
    expect(restore(container)).toBe(false)
    expect(container.scrollTop).toBe(0)
  })

  it('reset 后不再恢复（换账号 / 主动回顶）', () => {
    remember(300)
    reset()
    expect(getRemembered()).toBe(0)
    expect(restore()).toBe(false)
  })

  it('负数与小数会被归一（不会写入非法 scrollTop）', () => {
    remember(-40)
    expect(getRemembered()).toBe(0)
    remember(12.7)
    expect(getRemembered()).toBe(12)
  })
})

/** 给容器挂上列表根节点类名，让默认选择器能命中 */
function classList(el: HTMLElement): void {
  el.className = SESSION_LIST_SCROLL_SELECTOR.replace('.', '')
}

/**
 * 把元素伪装成「可滚动」。
 *
 * happy-dom 不做布局，`scrollHeight` / `clientHeight` 恒为 0，而 restore 现在会先判断
 * 「可滚距离够不够」（虚拟列表刚挂载时写 scrollTop 会被 clamp 成 0）。真实浏览器里
 * 这两个值来自布局，测试里必须显式给。
 */
function makeScrollable(el: HTMLElement, scrollHeight = 1000, clientHeight = 400): void {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
}
