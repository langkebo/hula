import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomEncryptedEventsPanel from '../RoomEncryptedEventsPanel.vue'
import { makeEncryptedEventsOutcome, makeEncryptedRoomEvent } from './fixtures/roomPanels'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getEncryptedEventsMock = vi.fn()

vi.mock('@/services/matrix/room/AccountDataService', () => ({
  matrixRoomAccountDataService: {
    getEncryptedEvents: (...args: unknown[]) => getEncryptedEventsMock(...args)
  }
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header"><slot name="header" /></div><div class="n-card-body"><slot /></div></div>',
    props: ['size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Empty: { template: '<div class="n-empty"><slot /></div>', props: ['description', 'size'] },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['type', 'size', 'round'] }
}

describe('RoomEncryptedEventsPanel — P2-9 房间加密事件列表面板', () => {
  beforeEach(() => {
    getEncryptedEventsMock.mockReset()
  })

  const mountPanel = async () => {
    const wrapper = mount(RoomEncryptedEventsPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('挂载时调用 getEncryptedEvents 加载加密事件', async () => {
    getEncryptedEventsMock.mockResolvedValue({ events: [] })
    await mountPanel()
    expect(getEncryptedEventsMock).toHaveBeenCalledWith('!room:hs')
  })

  it('加载中显示 loading 状态', () => {
    getEncryptedEventsMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RoomEncryptedEventsPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    expect(wrapper.find('.n-spin').exists()).toBe(true)
  })

  it('空列表显示空状态提示', async () => {
    getEncryptedEventsMock.mockResolvedValue({ events: [] })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('渲染加密事件列表（event_id、algorithm、session_id）', async () => {
    getEncryptedEventsMock.mockResolvedValue({
      events: [
        {
          event_id: '$e1:hs',
          algorithm: 'm.megolm.v1.aes-sha2',
          session_id: 'sess1',
          sender: '@alice:hs'
        },
        {
          event_id: '$e2:hs',
          algorithm: 'm.megolm.v1.aes-sha2',
          session_id: 'sess2',
          sender: '@bob:hs'
        }
      ]
    })
    const wrapper = await mountPanel()
    const items = wrapper.findAll('.encrypted-event-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('$e1:hs')
    expect(wrapper.text()).toContain('m.megolm.v1.aes-sha2')
    expect(wrapper.text()).toContain('sess1')
  })

  it('加载失败时显示错误态而不是空状态', async () => {
    getEncryptedEventsMock.mockRejectedValue(new Error('boom'))
    const wrapper = await mountPanel()

    expect(wrapper.find('[data-test="room-encrypted-events-error"]').exists()).toBe(true)
    expect(wrapper.find('.n-empty').exists()).toBe(false)
  })

  it('重试成功后恢复加密事件列表', async () => {
    getEncryptedEventsMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        makeEncryptedEventsOutcome([
          makeEncryptedRoomEvent({ event_id: '$e1:hs', algorithm: 'm.megolm.v1.aes-sha2', session_id: 'sess1' })
        ])
      )
    const wrapper = await mountPanel()

    await wrapper.find('[data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="room-encrypted-events-error"]').exists()).toBe(false)
    expect(wrapper.findAll('.encrypted-event-item')).toHaveLength(1)
  })
})
