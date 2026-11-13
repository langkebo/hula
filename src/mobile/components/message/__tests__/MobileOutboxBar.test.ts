import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18nMock } from '~/tests/i18n-messages'
import MobileOutboxBar from '../MobileOutboxBar.vue'

/**
 * Outbox 状态条的可见性契约：
 * 用户必须能看出「有几条待发送 / 几条发送失败」，失败时还要能手动重试或清除。
 */

vi.mock('vue-i18n', () => createI18nMock())

const mocks = vi.hoisted(() => ({
  getPendingCount: vi.fn(),
  getFailedCount: vi.fn(),
  retryFailed: vi.fn(),
  clearFailed: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: mocks
}))

let wrapper: ReturnType<typeof mount> | null = null

const mountBar = async () => {
  wrapper = mount(MobileOutboxBar)
  // onMounted 里的首次读取要等一次渲染刷新才反映到 DOM
  await nextTick()
  return wrapper
}

const setCounts = (pending: number, failed: number): void => {
  mocks.getPendingCount.mockReturnValue(pending)
  mocks.getFailedCount.mockReturnValue(failed)
}

describe('MobileOutboxBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.retryFailed.mockReturnValue(0)
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('pending=3、failed=0 时展示待发送数量，且不出现失败文案', async () => {
    setCounts(3, 0)
    const bar = await mountBar()

    const text = bar.find('[data-test="outbox-pending-text"]').text()
    expect(text).toContain('3')
    expect(text).not.toContain('失败')
    expect(bar.find('[data-test="outbox-retry-btn"]').exists()).toBe(false)
    expect(bar.find('[data-test="outbox-clear-btn"]').exists()).toBe(false)
  })

  it('failed=2 时优先展示失败数量与重试/清除按钮', async () => {
    setCounts(3, 2)
    const bar = await mountBar()

    const text = bar.find('[data-test="outbox-failed-text"]').text()
    expect(text).toContain('2')
    expect(text).toContain('失败')
    expect(bar.find('[data-test="outbox-retry-btn"]').exists()).toBe(true)
    expect(bar.find('[data-test="outbox-clear-btn"]').exists()).toBe(true)
  })

  it('点击重试调用 retryFailed 并刷新计数', async () => {
    setCounts(0, 2)
    const bar = await mountBar()

    // 重试后队列状态变化，计数必须重新读取
    mocks.retryFailed.mockImplementation(() => {
      setCounts(2, 0)
      return 2
    })

    await bar.find('[data-test="outbox-retry-btn"]').trigger('click')
    await nextTick()

    expect(mocks.retryFailed).toHaveBeenCalledTimes(1)
    expect(mocks.getPendingCount).toHaveBeenCalledTimes(2)
    expect(bar.find('[data-test="outbox-pending-text"]').text()).toContain('2')
  })

  it('点击清除调用 clearFailed', async () => {
    setCounts(0, 1)
    const bar = await mountBar()

    mocks.clearFailed.mockImplementation(() => {
      setCounts(0, 0)
    })

    await bar.find('[data-test="outbox-clear-btn"]').trigger('click')
    await nextTick()

    expect(mocks.clearFailed).toHaveBeenCalledTimes(1)
    expect(bar.find('[data-test="mobile-outbox-bar"]').exists()).toBe(false)
  })

  it('待发送与失败都为 0 时不渲染', async () => {
    setCounts(0, 0)
    const bar = await mountBar()

    expect(bar.find('[data-test="mobile-outbox-bar"]').exists()).toBe(false)
  })
})
