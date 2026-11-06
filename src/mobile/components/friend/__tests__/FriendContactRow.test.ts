import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'

/**
 * `FriendContactRow` 的显示名兜底。
 *
 * 历史缺陷：这一行只从 `groupStore.getUserInfo(uid)` 取名，刚登录时 groupStore 还没有
 * 这些联系人资料 ⇒ 好友列表渲染出一排名字为空的空白行（只剩「离线 / 删除」）。
 * 现在优先用列表数据（`MatrixContact.displayName/remark`）传进来的 name，
 * groupStore 作为补充，最后兜底到 userId —— 三者任一有值就不该是空。
 */

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: () => undefined
  })
}))

import FriendContactRow from '../FriendContactRow.vue'

const mountRow = (props: Record<string, unknown>) =>
  mount(FriendContactRow, {
    props: { userId: '@alice:matrix.test', ...props }
  })

describe('FriendContactRow 显示名', () => {
  it('优先用列表传入的 name（groupStore 没有资料时也不空白）', () => {
    const wrapper = mountRow({ name: 'Alice' })
    expect(wrapper.text()).toContain('Alice')
  })

  it('没有任何名字时兜底到 userId，而不是空字符串', () => {
    const wrapper = mountRow({})
    expect(wrapper.text()).toContain('@alice:matrix.test')
  })

  it('空字符串 name 视为未提供，仍然兜底', () => {
    const wrapper = mountRow({ name: '' })
    expect(wrapper.text()).toContain('@alice:matrix.test')
  })

  it('头像优先用传入的 avatarUrl（http 直链原样使用）', () => {
    const wrapper = mountRow({ name: 'Alice', avatar: 'https://cdn.test/a.png' })
    expect(wrapper.find('img').attributes('src')).toContain('a.png')
  })

  it('没有头像时回落到默认图，不会是空 src', () => {
    const wrapper = mountRow({ name: 'Alice' })
    expect(wrapper.find('img').attributes('src')).toBeTruthy()
  })
})
