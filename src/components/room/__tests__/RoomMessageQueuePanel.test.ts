import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomMessageQueuePanel from '../RoomMessageQueuePanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getMessageQueueMock = vi.fn()

vi.mock('@/services/matrix/room/AccountDataService', () => ({
  matrixRoomAccountDataService: {
    getMessageQueue: (...args: unknown[]) => getMessageQueueMock(...args)
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

describe('RoomMessageQueuePanel — P2-6 房间消息队列状态面板', () => {
  beforeEach(() => {
    getMessageQueueMock.mockReset()
  })

  const mountPanel = async () => {
    const wrapper = mount(RoomMessageQueuePanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('挂载时调用 getMessageQueue 加载队列', async () => {
    getMessageQueueMock.mockResolvedValue({ queue: [] })
    await mountPanel()
    expect(getMessageQueueMock).toHaveBeenCalledWith('!room:hs')
  })

  it('加载中显示 loading 状态', () => {
    getMessageQueueMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RoomMessageQueuePanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    expect(wrapper.find('.n-spin').exists()).toBe(true)
  })

  it('空队列显示空状态提示', async () => {
    getMessageQueueMock.mockResolvedValue({ queue: [] })
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('渲染队列中的待发送消息列表', async () => {
    getMessageQueueMock.mockResolvedValue({
      queue: [
        { event_id: '$e1:hs', type: 'm.room.message', content: { body: 'hello' } },
        { event_id: '$e2:hs', type: 'm.room.message', content: { body: 'world' } }
      ]
    })
    const wrapper = await mountPanel()
    const items = wrapper.findAll('.queue-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('$e1:hs')
    expect(wrapper.text()).toContain('m.room.message')
  })
})
