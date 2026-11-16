import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import RoomDetailDrawer from '../RoomDetailDrawer.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getCapabilityStatusMock = vi.fn()

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({ getCapabilityStatus: getCapabilityStatusMock })
}))

const getGroupDetailByRoomIdMock = vi.fn()
const loadRoomMembersMock = vi.fn()

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getGroupDetailByRoomId: getGroupDetailByRoomIdMock,
    loadRoomMembers: loadRoomMembersMock,
    getMembersLoadError: () => ''
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getRoom: vi.fn(() => null)
  }
}))

vi.mock('@/composables/room/usePinnedMessage', () => ({
  usePinnedMessage: () => ({
    pinnedEventIds: ref([]),
    pinnedMessages: ref([]),
    loading: ref(false),
    load: vi.fn()
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

const panelStub = (name: string) => ({ template: `<div data-testid="panel-${name}" />` })

const panelStubs = {
  RoomDetailStats: panelStub('stats'),
  RoomDetailLastMessage: panelStub('last-message'),
  RoomDetailPinnedMessages: panelStub('pinned-messages'),
  RoomDetailMembers: panelStub('members'),
  RoomMetadataPanel: panelStub('metadata'),
  RoomCapabilitiesPanel: panelStub('capabilities'),
  RoomMessageQueuePanel: panelStub('message-queue'),
  EventSignaturePanel: panelStub('event-signature'),
  RoomEncryptedEventsPanel: panelStub('encrypted-events'),
  RoomRetentionPanel: panelStub('retention')
}

const naiveStubs = {
  'n-spin': { template: '<div class="n-spin" />', props: ['size'] },
  'n-button': { template: '<button><slot /></button>', props: ['type', 'size', 'secondary'] }
}

const ROOM_ID = '!room:hs'

describe('RoomDetailDrawer — ROOM-02 四 Tab 能力面板接线', () => {
  beforeEach(() => {
    getCapabilityStatusMock.mockReset()
    getCapabilityStatusMock.mockReturnValue('supported')
    getGroupDetailByRoomIdMock.mockReset()
    getGroupDetailByRoomIdMock.mockResolvedValue({
      name: '测试房间',
      avatar: '',
      topic: 'topic',
      memberCount: 2,
      isEncrypted: true
    })
    loadRoomMembersMock.mockReset()
    loadRoomMembersMock.mockResolvedValue([])
  })

  const mountDrawer = async (roomId: string | null = ROOM_ID) => {
    const wrapper = mount(RoomDetailDrawer, {
      props: { roomId },
      global: { stubs: { teleport: true, ...panelStubs, ...naiveStubs } }
    })
    await flushPromises()
    return wrapper
  }

  it('默认展示概览 Tab，含统计 / 最近消息 / 房间元数据', async () => {
    const wrapper = await mountDrawer()

    expect(wrapper.find('[data-testid="room-drawer-panel-overview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-last-message"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-metadata"]').exists()).toBe(true)
  })

  it('切到成员 Tab 展示成员面板', async () => {
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-members"]').trigger('click')

    expect(wrapper.find('[data-testid="room-drawer-panel-members"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-members"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-metadata"]').exists()).toBe(false)
  })

  it('切到高级 Tab 展示房间能力 / 消息队列 / 置顶公告', async () => {
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-advanced"]').trigger('click')

    expect(wrapper.find('[data-testid="room-drawer-panel-advanced"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-capabilities"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-message-queue"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-pinned-messages"]').exists()).toBe(true)
  })

  it('E2EE 可用时安全 Tab 展示签名 / 加密事件 / 保留策略', async () => {
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-security"]').trigger('click')

    expect(wrapper.find('[data-testid="room-drawer-panel-security"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-event-signature"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-encrypted-events"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-retention"]').exists()).toBe(true)
  })

  it('E2EE 不支持时整块隐藏签名与加密事件，保留策略常驻', async () => {
    getCapabilityStatusMock.mockReturnValue('unsupported')
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-security"]').trigger('click')

    expect(wrapper.find('[data-testid="panel-event-signature"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="panel-encrypted-events"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="panel-retention"]').exists()).toBe(true)
  })

  it('E2EE 能力未知时仍展示安全面板，避免能力未加载时误删入口', async () => {
    getCapabilityStatusMock.mockReturnValue('unknown')
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-security"]').trigger('click')

    expect(wrapper.find('[data-testid="panel-event-signature"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="panel-encrypted-events"]').exists()).toBe(true)
  })

  it('逐个 Tab 切换后六个能力面板全部可达', async () => {
    const wrapper = await mountDrawer()
    const seen = new Set<string>()
    const collect = () => {
      for (const el of wrapper.findAll('[data-testid^="panel-"]')) {
        seen.add(el.attributes('data-testid') ?? '')
      }
    }

    collect()
    await wrapper.get('[data-testid="room-drawer-tab-security"]').trigger('click')
    collect()
    await wrapper.get('[data-testid="room-drawer-tab-advanced"]').trigger('click')
    collect()

    expect(seen).toEqual(
      new Set([
        'panel-stats',
        'panel-last-message',
        'panel-metadata',
        'panel-event-signature',
        'panel-encrypted-events',
        'panel-retention',
        'panel-capabilities',
        'panel-message-queue',
        'panel-pinned-messages'
      ])
    )
  })

  it('切换房间时重置回概览 Tab', async () => {
    const wrapper = await mountDrawer()

    await wrapper.get('[data-testid="room-drawer-tab-advanced"]').trigger('click')
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(wrapper.find('[data-testid="room-drawer-panel-overview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-drawer-panel-advanced"]').exists()).toBe(false)
  })
})
