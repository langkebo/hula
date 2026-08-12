import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PermissionsTab from '../settings-tabs/PermissionsTab.vue'

const { getPowerLevelsMock, setPowerLevelsMock, showFeedbackMock } = vi.hoisted(() => ({
  getPowerLevelsMock: vi.fn(),
  setPowerLevelsMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    getPowerLevels: getPowerLevelsMock,
    setPowerLevels: setPowerLevelsMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

// 先 mock naive-ui 模块，确保 auto-import 解析到的是 stub 而非真实组件
vi.mock('naive-ui', () => ({
  NSelect: {
    name: 'NSelect',
    props: {
      value: { type: [Number, String], default: 0 },
      options: { type: Array, default: () => [] },
      size: { type: String, default: '' }
    },
    emits: ['update:value'],
    template:
      '<select data-testid="permissions-level-select" :value="value" @change="$emit(\'update:value\', Number($event.target.value))"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>'
  },
  NButton: {
    name: 'NButton',
    props: { disabled: Boolean, loading: Boolean, type: String },
    emits: ['click'],
    template:
      '<button :disabled="disabled" data-testid="permissions-save-button" @click="$emit(\'click\')"><slot /></button>'
  },
  NSpin: {
    name: 'NSpin',
    template: '<div data-testid="n-spin"><slot /></div>'
  }
}))

const globalStubs = {
  NSpin: { template: '<div class="n-spin" data-testid="n-spin"><slot /></div>' },
  NButton: {
    emits: ['click'],
    props: { disabled: Boolean, loading: Boolean, type: String },
    template:
      '<button class="n-button" :disabled="disabled" data-testid="permissions-save-button" @click="$emit(\'click\')"><slot /></button>'
  },
  NSelect: {
    name: 'NSelect',
    props: {
      value: { type: [Number, String], default: 0 },
      options: { type: Array, default: () => [] },
      size: { type: String, default: '' }
    },
    emits: ['update:value'],
    template:
      '<select data-testid="permissions-level-select" :value="value" @change="$emit(\'update:value\', Number($event.target.value))"><option v-for="opt in options" :key="opt.value" :value="opt.value" :selected="opt.value === value">{{ opt.label }}</option></select>'
  }
}

const ROOM_ID = '!perm-room:matrix.org'

const SAMPLE_POWER_LEVELS = {
  ban: 50,
  invite: 0,
  events_default: 0,
  state_default: 50,
  events: {
    'm.room.message': 0,
    'm.room.topic': 50,
    'm.room.name': 100
  }
}

const mountTab = async (powerLevels: Record<string, unknown> = SAMPLE_POWER_LEVELS) => {
  getPowerLevelsMock.mockResolvedValue(powerLevels)
  const wrapper = mount(PermissionsTab, {
    props: { roomId: ROOM_ID },
    global: { stubs: globalStubs }
  })
  await flushPromises()
  return wrapper
}

describe('PermissionsTab — 加载与展示', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载时调用 getPowerLevels 加载权限数据', async () => {
    await mountTab()
    expect(getPowerLevelsMock).toHaveBeenCalledWith(ROOM_ID)
  })

  it('加载中显示 loading 状态', async () => {
    getPowerLevelsMock.mockImplementation(() => new Promise(() => {})) // 永不 resolve
    const wrapper = mount(PermissionsTab, {
      props: { roomId: ROOM_ID },
      global: { stubs: globalStubs }
    })
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[data-testid="permissions-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="permissions-save-button"]').exists()).toBe(false)
  })

  it('加载完成后显示 5 行权限配置', async () => {
    const wrapper = await mountTab()

    const labels = wrapper.findAll('.rs-tab__power-cell--label')
    expect(labels).toHaveLength(5)
    expect(labels[0].text()).toContain('permission_kick')
    expect(labels[1].text()).toContain('permission_invite')
    expect(labels[2].text()).toContain('permission_send_message')
    expect(labels[3].text()).toContain('permission_modify_topic')
    expect(labels[4].text()).toContain('permission_modify_name')
  })

  it('正确读取 ban 权限值用于 kick 行', async () => {
    const wrapper = await mountTab({ ban: 100, invite: 0, events_default: 0, state_default: 50 })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[0].text()).toBe('100')
  })

  it('正确读取 invite 权限值', async () => {
    const wrapper = await mountTab({ ban: 50, invite: 100, events_default: 0, state_default: 50 })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[1].text()).toBe('100')
  })

  it('优先从 events[m.room.message] 读取 send_message 权限', async () => {
    const wrapper = await mountTab({
      ban: 50,
      invite: 0,
      events_default: 0,
      state_default: 50,
      events: { 'm.room.message': 100 }
    })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[2].text()).toBe('100')
  })

  it('events 中无 m.room.message 时回退到 events_default', async () => {
    const wrapper = await mountTab({
      ban: 50,
      invite: 0,
      events_default: 25,
      state_default: 50,
      events: {}
    })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[2].text()).toBe('25')
  })

  it('优先从 events[m.room.topic] 读取 modify_topic 权限', async () => {
    const wrapper = await mountTab({
      ban: 50,
      invite: 0,
      events_default: 0,
      state_default: 50,
      events: { 'm.room.topic': 100 }
    })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[3].text()).toBe('100')
  })

  it('events 中无 m.room.name 时回退到 state_default', async () => {
    const wrapper = await mountTab({
      ban: 50,
      invite: 0,
      events_default: 0,
      state_default: 75,
      events: {}
    })
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[4].text()).toBe('75')
  })

  it('所有字段缺失时默认为 0', async () => {
    const wrapper = await mountTab({})
    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    currentValues.forEach((cell) => {
      expect(cell.text()).toBe('0')
    })
  })

  it('加载失败时显示错误反馈', async () => {
    getPowerLevelsMock.mockRejectedValue(new Error('network'))
    mount(PermissionsTab, {
      props: { roomId: ROOM_ID },
      global: { stubs: globalStubs }
    })
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
  })
})

describe('PermissionsTab — 保存逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无修改时保存按钮禁用', async () => {
    const wrapper = await mountTab()
    const saveBtn = wrapper.find('[data-testid="permissions-save-button"]')
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('修改 draft 值后保存按钮启用', async () => {
    const wrapper = await mountTab()

    // 通过组件实例直接触发 update:value 事件，避免 DOM stub 兼容问题
    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100)
    await flushPromises()

    const saveBtn = wrapper.find('[data-testid="permissions-save-button"]')
    expect(saveBtn.attributes('disabled')).toBeUndefined()
  })

  it('保存时调用 setPowerLevels 并合并修改后的 ban 值', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100) // kick (ban) 50 → 100
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    expect(setPowerLevelsMock).toHaveBeenCalledTimes(1)
    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['ban']).toBe(100)
  })

  it('保存时合并 invite 修改到 content', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[1].vm.$emit('update:value', 50) // invite 0 → 50
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['invite']).toBe(50)
  })

  it('保存时合并 events_default 和 events[m.room.message]', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[2].vm.$emit('update:value', 50) // send_message 0 → 50
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['events_default']).toBe(50)
    expect(content['events']['m.room.message']).toBe(50)
  })

  it('保存时合并 state_default 和 events[m.room.topic]', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[3].vm.$emit('update:value', 100) // modify_topic 50 → 100
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['state_default']).toBe(100)
    expect(content['events']['m.room.topic']).toBe(100)
  })

  it('保存时合并 events[m.room.name] 但不修改 state_default', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[4].vm.$emit('update:value', 50) // modify_name 100 → 50
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['events']['m.room.name']).toBe(50)
    expect(content['state_default']).toBe(50)
  })

  it('保存时保留原始 power levels 中未修改的字段', async () => {
    const wrapper = await mountTab({
      ban: 50,
      invite: 0,
      events_default: 0,
      state_default: 50,
      events: {
        'm.room.message': 0,
        'm.room.topic': 50,
        'm.room.name': 100,
        'm.room.custom': 75
      },
      users: { '@admin:server': 100 },
      users_default: 0,
      redacts: 50
    })

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100) // kick 50 → 100
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const [, content] = setPowerLevelsMock.mock.calls[0]
    expect(content['users']).toEqual({ '@admin:server': 100 })
    expect(content['users_default']).toBe(0)
    expect(content['redacts']).toBe(50)
    expect(content['events']['m.room.custom']).toBe(75)
  })

  it('保存成功后显示成功反馈', async () => {
    const wrapper = await mountTab()
    setPowerLevelsMock.mockResolvedValue(undefined)

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100)
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')
  })

  it('保存失败时显示错误反馈', async () => {
    const wrapper = await mountTab()
    setPowerLevelsMock.mockRejectedValue(new Error('forbidden'))

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100)
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
  })

  it('保存成功后 current 值更新为 draft 值', async () => {
    const wrapper = await mountTab()
    setPowerLevelsMock.mockResolvedValue(undefined)

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100) // kick 50 → 100
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const currentValues = wrapper.findAll('[data-testid="permissions-current-value"]')
    expect(currentValues[0].text()).toBe('100')
  })

  it('保存成功后保存按钮重新禁用', async () => {
    const wrapper = await mountTab()
    setPowerLevelsMock.mockResolvedValue(undefined)

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100)
    await flushPromises()

    await wrapper.find('[data-testid="permissions-save-button"]').trigger('click')
    await flushPromises()

    const saveBtn = wrapper.find('[data-testid="permissions-save-button"]')
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('修改后又改回原值时保存按钮禁用', async () => {
    const wrapper = await mountTab()

    const selects = wrapper.findAllComponents({ name: 'NSelect' })
    selects[0].vm.$emit('update:value', 100)
    await flushPromises()
    expect(wrapper.find('[data-testid="permissions-save-button"]').attributes('disabled')).toBeUndefined()

    selects[0].vm.$emit('update:value', 50)
    await flushPromises()
    expect(wrapper.find('[data-testid="permissions-save-button"]').attributes('disabled')).toBeDefined()
  })
})
