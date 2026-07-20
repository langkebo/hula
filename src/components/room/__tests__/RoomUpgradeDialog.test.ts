import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'

type FlowMock = {
  currentVersion: Ref<string | null>
  availableVersions: Ref<Array<{ version: string; status?: string }>>
  targetVersion: Ref<string | null>
  loading: Ref<boolean>
  upgrading: Ref<boolean>
  errorMessage: Ref<string | null>
  hasVersions: Ref<boolean>
  load: ReturnType<typeof vi.fn>
  upgrade: ReturnType<typeof vi.fn>
  resolveTargetVersion: ReturnType<typeof vi.fn>
}

const holder = vi.hoisted(() => ({ flowMock: null as unknown as FlowMock }))

vi.mock('@/composables/room/useRoomUpgradeFlow', async () => {
  const { ref, computed } = await import('vue')
  const availableVersions = ref<Array<{ version: string; status?: string }>>([])
  holder.flowMock = {
    currentVersion: ref<string | null>(null),
    availableVersions,
    targetVersion: ref<string | null>(null),
    loading: ref(false),
    upgrading: ref(false),
    errorMessage: ref<string | null>(null),
    hasVersions: computed(() => availableVersions.value.length > 0),
    load: vi.fn(),
    upgrade: vi.fn(),
    resolveTargetVersion: vi.fn()
  }
  return { useRoomUpgradeFlow: () => holder.flowMock }
})

import RoomUpgradeDialog from '../RoomUpgradeDialog.vue'

// naive-ui 组件注册名不带 N 前缀（NModal.name === 'Modal'），stub key 需按注册名匹配
const naiveStubs = {
  Modal: { template: '<div class="n-modal-stub"><slot /><slot name="footer" /></div>', props: ['show'] },
  Spin: { template: '<div class="n-spin-stub"><slot /></div>', props: ['show'] },
  Tag: { template: '<span class="n-tag-stub"><slot /></span>' },
  Select: {
    template: '<select class="n-select-stub" :disabled="disabled" />',
    props: ['value', 'options', 'disabled']
  },
  Alert: { template: '<div class="n-alert-stub"><slot /></div>' },
  Button: {
    template: '<button class="n-button-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type'],
    emits: ['click']
  }
}

const mountDialog = (props: Record<string, unknown> = {}) =>
  mount(RoomUpgradeDialog, {
    props: { visible: true, roomId: '!room:hs', ...props },
    global: { stubs: naiveStubs }
  })

describe('RoomUpgradeDialog', () => {
  beforeEach(() => {
    const flow = holder.flowMock
    flow.load.mockReset()
    flow.upgrade.mockReset()
    flow.resolveTargetVersion.mockReset()
    flow.currentVersion.value = null
    flow.availableVersions.value = []
    flow.targetVersion.value = null
    flow.loading.value = false
    flow.upgrading.value = false
    flow.errorMessage.value = null
    flow.upgrade.mockResolvedValue(null)
    flow.resolveTargetVersion.mockReturnValue(null)
  })

  it('打开时触发版本加载', () => {
    mountDialog()
    expect(holder.flowMock.load).toHaveBeenCalledTimes(1)
  })

  it('visible=false 时不加载', () => {
    mountDialog({ visible: false })
    expect(holder.flowMock.load).not.toHaveBeenCalled()
  })

  it('展示当前版本且有可用版本时选择器可用', () => {
    holder.flowMock.currentVersion.value = '9'
    holder.flowMock.availableVersions.value = [{ version: '10', status: 'stable' }, { version: '11' }]

    const wrapper = mountDialog()

    expect(wrapper.find('.n-tag-stub').text()).toBe('9')
    expect(wrapper.find('.n-select-stub').attributes('disabled')).toBeUndefined()
  })

  it('无可用版本时选择器与提交按钮均禁用', () => {
    const wrapper = mountDialog()

    expect(wrapper.find('.n-select-stub').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.n-button-stub').at(-1)?.attributes('disabled')).toBeDefined()
  })

  it('展示错误信息', () => {
    holder.flowMock.errorMessage.value = '升级失败：权限不足'
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('升级失败：权限不足')
  })

  it('升级成功后 emit upgraded 与关闭事件', async () => {
    holder.flowMock.availableVersions.value = [{ version: '10' }]
    holder.flowMock.resolveTargetVersion.mockReturnValue('10')
    holder.flowMock.upgrade.mockResolvedValue('!new-room:hs')

    const wrapper = mountDialog()
    await wrapper.findAll('.n-button-stub').at(-1)?.trigger('click')
    await Promise.resolve()

    expect(holder.flowMock.upgrade).toHaveBeenCalledWith('10')
    expect(wrapper.emitted('upgraded')).toEqual([['!new-room:hs']])
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('升级失败（返回空）时不关闭对话框', async () => {
    holder.flowMock.availableVersions.value = [{ version: '10' }]
    holder.flowMock.resolveTargetVersion.mockReturnValue('10')
    holder.flowMock.upgrade.mockResolvedValue(null)

    const wrapper = mountDialog()
    await wrapper.findAll('.n-button-stub').at(-1)?.trigger('click')
    await Promise.resolve()

    expect(wrapper.emitted('upgraded')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toBeUndefined()
  })

  it('取消按钮关闭对话框', async () => {
    const wrapper = mountDialog()
    await wrapper.findAll('.n-button-stub').at(0)?.trigger('click')

    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })
})
