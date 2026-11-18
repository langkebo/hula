import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomTurnServerSection from '../RoomTurnServerSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  getRoomTurnServer: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRoomTurnServer: mocks.getRoomTurnServer }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="turn-server-loading" />', props: ['size'] },
  Button: {
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'type', 'loading'],
    emits: ['click']
  }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomTurnServerSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

describe('RoomTurnServerSection — 房间级 TURN 只读诊断区块', () => {
  beforeEach(() => {
    mocks.getRoomTurnServer.mockReset()
  })

  it('挂载时按 roomId 读取 TURN 配置', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({ status: 'empty' })
    await mountSection()

    expect(mocks.getRoomTurnServer).toHaveBeenCalledWith('!room:hs')
  })

  it('渲染 URI 列表与 TTL', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({
      status: 'ok',
      config: { uris: ['turn:e?transport=udp', 'turns:e'], ttl: 86400 }
    })
    const wrapper = await mountSection()

    const uris = wrapper.findAll('[data-testid="turn-server-uri"]')
    expect(uris.map((item) => item.text())).toEqual(['turn:e?transport=udp', 'turns:e'])
    expect(wrapper.find('[data-testid="turn-server-ttl"]').text()).toContain('86400')
  })

  it('ttl 缺失时不渲染 TTL 行', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({ status: 'ok', config: { uris: ['turn:e'], ttl: null } })
    const wrapper = await mountSection()

    expect(wrapper.findAll('[data-testid="turn-server-uri"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="turn-server-ttl"]').exists()).toBe(false)
  })

  it('空态展示未下发配置提示', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="turn-server-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="turn-server-uri"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 提示', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="turn-server-unsupported"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="turn-server-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示失败与重试，重试成功后渲染列表', async () => {
    mocks.getRoomTurnServer.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="turn-server-error"]').exists()).toBe(true)

    mocks.getRoomTurnServer.mockResolvedValue({ status: 'ok', config: { uris: ['turn:e'], ttl: null } })
    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="turn-server-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="turn-server-uri"]')).toHaveLength(1)
  })

  it('roomId 变化时重新读取', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    mocks.getRoomTurnServer.mockResolvedValue({ status: 'ok', config: { uris: ['turns:e'], ttl: 60 } })
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRoomTurnServer).toHaveBeenLastCalledWith('!other:hs')
    expect(wrapper.findAll('[data-testid="turn-server-uri"]')).toHaveLength(1)
  })

  it('界面不出现 TURN 凭据字段', async () => {
    mocks.getRoomTurnServer.mockResolvedValue({
      status: 'ok',
      config: { uris: ['turn:e'], ttl: 60, username: 'user', password: 'secret' }
    })
    const wrapper = await mountSection()
    const html = wrapper.html()

    expect(html).not.toContain('username')
    expect(html).not.toContain('password')
    expect(html).not.toContain('secret')
  })
})
