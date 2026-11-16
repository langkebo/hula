import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import MessageEditHistoryDialog from '../MessageEditHistoryDialog.vue'

vi.mock('vue-i18n', () => createI18nMock())

const { refreshEditHistoryMock } = vi.hoisted(() => ({ refreshEditHistoryMock: vi.fn() }))

vi.mock('@/services/matrix/messaging/MatrixMessageRelationService', () => ({
  matrixMessageRelationService: {
    refreshEditHistory: (...args: unknown[]) => refreshEditHistoryMock(...args)
  }
}))

/** n-modal 只负责承载 slot；这里不测弹层动效，只测内容与取数 */
vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')
  return {
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'title', 'preset', 'bordered', 'closable', 'maskClosable'],
      template: '<div v-if="show" class="modal-stub"><slot /></div>'
    })
  }
})

const mountDialog = (props: { show: boolean; roomId: string; eventId: string }) =>
  mount(MessageEditHistoryDialog, { props })

const edit = (eventId: string, body: string, timestamp: number) => ({
  eventId,
  originalContent: {},
  newContent: { body },
  timestamp,
  sender: '@u:test'
})

describe('MessageEditHistoryDialog', () => {
  beforeEach(() => {
    refreshEditHistoryMock.mockReset()
  })

  it('打开时按服务端事件 ID 拉取并逐版渲染', async () => {
    refreshEditHistoryMock.mockResolvedValue([edit('$e1', '第一版内容', 1000), edit('$e2', '第二版内容', 2000)])

    const wrapper = mountDialog({ show: true, roomId: '!r:test', eventId: '$origin' })
    await flushPromises()

    expect(refreshEditHistoryMock).toHaveBeenCalledWith('!r:test', '$origin')
    const items = wrapper.findAll('.edit-history-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('第一版内容')
    expect(items[1].text()).toContain('第二版内容')
    // 版本序号来自真实语言表（`第 {n} 版`），不是桩文案
    expect(items[0].text()).toContain('第 1 版')
    expect(items[1].text()).toContain('第 2 版')
  })

  it('没有历史版本时显示空态（而不是空白弹窗）', async () => {
    refreshEditHistoryMock.mockResolvedValue([])

    const wrapper = mountDialog({ show: true, roomId: '!r:test', eventId: '$origin' })
    await flushPromises()

    expect(wrapper.text()).toContain('这条消息没有历史版本')
    expect(wrapper.findAll('.edit-history-item')).toHaveLength(0)
  })

  it('服务层抛错时退化为空态，不把异常抛给渲染层', async () => {
    refreshEditHistoryMock.mockRejectedValue(new Error('boom'))

    const wrapper = mountDialog({ show: true, roomId: '!r:test', eventId: '$origin' })
    await flushPromises()

    expect(wrapper.text()).toContain('这条消息没有历史版本')
  })

  it('未打开时不去拉取（避免消息列表每条都打一次 /relations）', async () => {
    mountDialog({ show: false, roomId: '!r:test', eventId: '$origin' })
    await flushPromises()

    expect(refreshEditHistoryMock).not.toHaveBeenCalled()
  })

  it('缺少 roomId/eventId 时不发请求', async () => {
    mountDialog({ show: true, roomId: '', eventId: '' })
    await flushPromises()

    expect(refreshEditHistoryMock).not.toHaveBeenCalled()
  })
})
