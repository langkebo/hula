import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import HeaderBar from '../HeaderBar.vue'

/**
 * 移动端聊天头部「房间 homeserver 可见」接线契约。
 *
 * 背景：`RoomHomeserverLabel.vue` 创建后长期零接入。头部此前只在**联邦房间**里
 * 用 `FederationBadge` 顺带显示域名（本地房间什么都不显示），本组用例锁死：
 *  1. `roomServer` 驱动域名 chip 常显（与是否联邦无关）；
 *  2. 联邦房间改为「域名 chip + 图标徽章」，域名不得重复出现；
 *  3. 房间名与 chip 同处一个容器（原来是单列 grid，多子元素会各自换行，撑破 56px 头部）。
 *
 * i18n 走真实 zh-CN 语言表（`createI18nMock`）。
 */

vi.mock('vue-i18n', () => createI18nMock())
vi.mock('@/router', () => ({ default: { back: vi.fn(), push: vi.fn() } }))

const mountBar = (props: Record<string, unknown> = {}) =>
  mount(HeaderBar, { props: { roomName: 'TJ 官方频道', ...props } })

describe('HeaderBar 房间 homeserver 标识', () => {
  it('roomServer 非空时渲染域名 chip（本地房间也显示）', () => {
    const wrapper = mountBar({ roomServer: 'matrix.test' })

    const chip = wrapper.find('[data-testid="room-homeserver-label"]')
    expect(chip.exists(), '未接入 RoomHomeserverLabel').toBe(true)
    expect(chip.text()).toBe('matrix.test')
    // 非联邦房间不应出现联邦徽章
    expect(wrapper.find('[data-testid="federation-badge"]').exists()).toBe(false)
  })

  it('roomServer 缺省时不渲染域名 chip', () => {
    const wrapper = mountBar()

    expect(wrapper.find('[data-testid="room-homeserver-label"]').exists()).toBe(false)
  })

  it('域名 chip 由 roomServer 驱动：改值即改文案', () => {
    const wrapper = mountBar({ roomServer: 'remote.example' })

    expect(wrapper.find('[data-testid="room-homeserver-label"]').text()).toBe('remote.example')
  })

  it('联邦房间：域名 chip 与联邦图标徽章并存，且域名只出现一次', () => {
    const wrapper = mountBar({ roomServer: 'remote.example', federationServer: 'remote.example' })

    expect(wrapper.find('[data-testid="room-homeserver-label"]').text()).toBe('remote.example')

    const badge = wrapper.find('[data-testid="federation-badge"]')
    expect(badge.exists()).toBe(true)
    // 徽章只留图标（show-label=false），否则域名会被重复渲染一次
    expect(badge.text()).toBe('')

    const occurrences = wrapper.text().split('remote.example').length - 1
    expect(occurrences, '域名在头部出现多次，说明 chip 与徽章标签重复').toBe(1)
  })

  it('房间名与域名 chip 同处一个容器（避免多子元素各自换行撑破固定高度头部）', () => {
    const wrapper = mountBar({ roomServer: 'matrix.test' })

    const container = wrapper.find('.chat-room-name-official')
    expect(container.exists()).toBe(true)
    expect(container.find('.chat-room-name__text').text()).toContain('TJ 官方频道')
    expect(container.find('[data-testid="room-homeserver-label"]').exists()).toBe(true)
    // 徽章与 chip 必须是同一层级的兄弟节点，而不是各自独占一行
    expect(container.element.children.length).toBeGreaterThanOrEqual(2)
  })

  it('非官方房间沿用 chat-room-name 容器，同样承载域名 chip', () => {
    const wrapper = mountBar({ roomServer: 'matrix.test', isOfficial: false })

    const container = wrapper.find('.chat-room-name')
    expect(container.exists()).toBe(true)
    expect(container.find('[data-testid="room-homeserver-label"]').exists()).toBe(true)
  })
})
