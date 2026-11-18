import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomPermissionSnapshotSection from '../RoomPermissionSnapshotSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  getRoomPermissions: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRoomPermissions: mocks.getRoomPermissions }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="permission-snapshot-loading" />', props: ['size'] },
  Button: {
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'type', 'loading'],
    emits: ['click']
  }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomPermissionSnapshotSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

const okOutcome = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  permissions: {
    roomId: '!room:hs',
    powerLevel: 50,
    canSend: true,
    canInvite: false,
    canKick: true,
    canBan: false,
    canRedact: true,
    raw: {},
    ...overrides
  }
})

describe('RoomPermissionSnapshotSection — 当前权限快照只读区块', () => {
  beforeEach(() => {
    mocks.getRoomPermissions.mockReset()
  })

  it('挂载时按 roomId 读取权限快照', async () => {
    mocks.getRoomPermissions.mockResolvedValue(okOutcome())
    await mountSection()

    expect(mocks.getRoomPermissions).toHaveBeenCalledWith('!room:hs')
  })

  it('渲染权限等级与五项能力位文案', async () => {
    mocks.getRoomPermissions.mockResolvedValue(okOutcome())
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="permission-snapshot-power-level"]').text()).toBe('50')
    expect(wrapper.find('[data-testid="permission-snapshot-can-send"]').text()).toContain(
      'room.settings_drawer.permission_snapshot_allowed'
    )
    expect(wrapper.find('[data-testid="permission-snapshot-can-invite"]').text()).toContain(
      'room.settings_drawer.permission_snapshot_denied'
    )
  })

  it('字段缺失（null）展示未知而不伪装禁止', async () => {
    mocks.getRoomPermissions.mockResolvedValue(
      okOutcome({ powerLevel: null, canSend: null, canInvite: null, canKick: null, canBan: null, canRedact: null })
    )
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="permission-snapshot-power-level"]').text()).toBe(
      'room.settings_drawer.permission_snapshot_unknown'
    )
    expect(wrapper.find('[data-testid="permission-snapshot-can-send"]').text()).toContain(
      'room.settings_drawer.permission_snapshot_unknown'
    )
  })

  it('空态展示空提示', async () => {
    mocks.getRoomPermissions.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="permission-snapshot-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="permission-snapshot-power-level"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 提示', async () => {
    mocks.getRoomPermissions.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="permission-snapshot-unsupported"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="permission-snapshot-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示失败与重试，重试成功后渲染快照', async () => {
    mocks.getRoomPermissions.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="permission-snapshot-error"]').exists()).toBe(true)

    mocks.getRoomPermissions.mockResolvedValue(okOutcome())
    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="permission-snapshot-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="permission-snapshot-power-level"]').text()).toBe('50')
  })

  it('roomId 变化时重新读取', async () => {
    mocks.getRoomPermissions.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    mocks.getRoomPermissions.mockResolvedValue(okOutcome())
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRoomPermissions).toHaveBeenLastCalledWith('!other:hs')
    expect(wrapper.find('[data-testid="permission-snapshot-power-level"]').text()).toBe('50')
  })
})
