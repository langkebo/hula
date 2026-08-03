import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomMetadataPanel from '../RoomMetadataPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getRoomMetadataMock = vi.fn()

vi.mock('@/services/matrix/room/MetadataService', () => ({
  matrixRoomMetadataService: {
    getRoomMetadata: (...args: unknown[]) => getRoomMetadataMock(...args)
  }
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header">{{ title }}</div><div class="n-card-body"><slot /></div></div>',
    props: ['title', 'size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Descriptions: {
    template: '<div class="n-descriptions"><slot /></div>',
    props: ['bordered', 'column', 'labelPlacement', 'size']
  },
  DescriptionsItem: {
    template:
      '<div class="n-descriptions-item"><span class="n-descriptions-label">{{ label }}</span><span class="n-descriptions-content"><slot /></span></div>',
    props: ['label']
  },
  Empty: { template: '<div class="n-empty">{{ description }}</div>', props: ['description', 'size'] }
}

const sampleMetadata = {
  room_id: '!room:hs',
  room_version: '11',
  created_ts: 1700000000000,
  member_count: 42,
  creator: '@admin:hs',
  encryption: 'm.megolm.v1.aes-sha2',
  join_rule: 'invite',
  history_visibility: 'shared'
}

describe('RoomMetadataPanel — P2-3 房间元数据面板', () => {
  beforeEach(() => {
    getRoomMetadataMock.mockReset()
  })

  const mountPanel = (props: Record<string, unknown> = {}) =>
    mount(RoomMetadataPanel, {
      props: { roomId: '!room:hs', ...props },
      global: { stubs: naiveStubs }
    })

  it('挂载时加载房间元数据', async () => {
    getRoomMetadataMock.mockResolvedValue(sampleMetadata)

    const wrapper = mountPanel()
    await flushPromises()

    expect(getRoomMetadataMock).toHaveBeenCalledWith('!room:hs')
    expect(wrapper.find('[data-testid="room-metadata-panel"]').exists()).toBe(true)
  })

  it('显示元数据字段（room_version/creator/member_count）', async () => {
    getRoomMetadataMock.mockResolvedValue(sampleMetadata)

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('11')
    expect(wrapper.text()).toContain('@admin:hs')
    expect(wrapper.text()).toContain('42')
  })

  it('元数据为空对象时显示空状态', async () => {
    getRoomMetadataMock.mockResolvedValue({})

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('加载失败时降级显示空状态', async () => {
    getRoomMetadataMock.mockRejectedValue(new Error('boom'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
