import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    retryDecryptMessage: vi.fn(),
    getRawMessageJson: vi.fn()
  }
}))

import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import DecryptionFailureCard from '../DecryptionFailureCard.vue'

const mountCard = () =>
  mount(DecryptionFailureCard, {
    props: {
      roomId: '!room:id',
      eventId: '$bad'
    }
  })

describe('DecryptionFailureCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染标题、说明与两个操作按钮', () => {
    const wrapper = mountCard()

    expect(wrapper.find('[data-testid="decryption-failure-card"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('message_container.decrypt_failed.title')
    expect(wrapper.text()).toContain('message_container.decrypt_failed.desc')
    expect(wrapper.find('[data-testid="decryption-retry"]').text()).toBe('message_container.retry')
    expect(wrapper.find('[data-testid="decryption-toggle-raw"]').text()).toBe(
      'message_container.decrypt_failed.view_raw'
    )
    expect(wrapper.find('[data-testid="decryption-failure-error"]').exists()).toBe(false)
  })

  it('重试成功时不显示错误', async () => {
    vi.mocked(matrixMessageService.retryDecryptMessage).mockResolvedValue(true)
    const wrapper = mountCard()

    await wrapper.find('[data-testid="decryption-retry"]').trigger('click')
    await flushPromises()

    expect(matrixMessageService.retryDecryptMessage).toHaveBeenCalledWith('!room:id', '$bad')
    expect(wrapper.find('[data-testid="decryption-failure-error"]').exists()).toBe(false)
  })

  it('重试失败时显示错误且保留卡片', async () => {
    vi.mocked(matrixMessageService.retryDecryptMessage).mockResolvedValue(false)
    const wrapper = mountCard()

    await wrapper.find('[data-testid="decryption-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="decryption-failure-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="decryption-failure-card"]').exists()).toBe(true)
  })

  it('重试期间按钮禁用，重复点击只触发一次解密', async () => {
    let resolveRetry: (value: boolean) => void = () => {}
    vi.mocked(matrixMessageService.retryDecryptMessage).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRetry = resolve
        })
    )
    const wrapper = mountCard()
    const button = wrapper.find('[data-testid="decryption-retry"]')

    await button.trigger('click')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')

    expect(matrixMessageService.retryDecryptMessage).toHaveBeenCalledTimes(1)

    resolveRetry(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="decryption-retry"]').attributes('disabled')).toBeUndefined()
  })

  it('查看原始事件：展开后再次点击收起', async () => {
    vi.mocked(matrixMessageService.getRawMessageJson).mockResolvedValue('{"type":"m.room.encrypted"}')
    const wrapper = mountCard()
    const toggle = wrapper.find('[data-testid="decryption-toggle-raw"]')

    await toggle.trigger('click')
    await flushPromises()

    expect(matrixMessageService.getRawMessageJson).toHaveBeenCalledWith('!room:id', '$bad')
    expect(wrapper.find('[data-testid="decryption-failure-raw"]').text()).toBe('{"type":"m.room.encrypted"}')
    expect(toggle.text()).toBe('message_container.decrypt_failed.hide_raw')

    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="decryption-failure-raw"]').exists()).toBe(false)
    expect(toggle.text()).toBe('message_container.decrypt_failed.view_raw')
  })

  it('原始事件读取失败时展示不可用提示', async () => {
    vi.mocked(matrixMessageService.getRawMessageJson).mockResolvedValue(null)
    const wrapper = mountCard()

    await wrapper.find('[data-testid="decryption-toggle-raw"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="decryption-failure-raw"]').text()).toBe(
      'message_container.decrypt_failed.raw_unavailable'
    )
  })
})
