import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PendingBurnMessages from '../PendingBurnMessages.vue'

const getPendingBurnsMock = vi.fn()
const cancelBurnMock = vi.fn().mockResolvedValue(true)

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    getPendingBurns: getPendingBurnsMock,
    cancelBurn: cancelBurnMock
  })
}))

// 显式 mock naive-ui 组件：使用真实 <button>/<div> 模板，inheritAttrs 默认 true
// 使 :data-testid 透传到根元素；NButton 模板内 <button @click="$emit('click')">
// 确保原生点击触发组件 @click 处理器（与 RoomBurnSettings.test.ts 同款模式）。
// 注意：不使用 global.stubs 字符串桩，因为字符串桩不渲染 slot，会吞掉
// <n-spin> 内部的 data-testid 节点。vi.mock 提供的真实模板足以渲染。
vi.mock('naive-ui', () => ({
  NSpin: { name: 'NSpin', template: '<div class="n-spin-stub"><slot /></div>' },
  NEmpty: { name: 'NEmpty', template: '<div class="n-empty-stub"><slot /></div>' },
  NButton: {
    name: 'NButton',
    template: '<button @click="$emit(\'click\')"><slot /></button>'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && 'count' in params) {
        return `${params.count}`
      }
      return key
    },
    locale: { value: 'zh-CN' }
  })
}))

describe('PendingBurnMessages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no pending messages', async () => {
    getPendingBurnsMock.mockResolvedValueOnce([])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="pending-empty"]').exists()).toBe(true)
  })

  it('renders list items with preview, created time, remaining time, cancel button', async () => {
    const now = Date.now()
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1:server', createdAt: now - 30000, deleteAt: now + 30000 }
    ])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="pending-item-$e1:server"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pending-cancel-$e1:server"]').exists()).toBe(true)
  })

  it('calls cancelBurn when cancel button clicked', async () => {
    const now = Date.now()
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1:server', createdAt: now - 30000, deleteAt: now + 30000 }
    ])
    const wrapper = mount(PendingBurnMessages, {
      props: { roomId: '!room1:server' }
    })
    await flushPromises()
    await wrapper.find('[data-testid="pending-cancel-$e1:server"]').trigger('click')
    await flushPromises()
    expect(cancelBurnMock).toHaveBeenCalledWith('!room1:server', '$e1:server')
  })
})
