import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomEncryptionSettings from '../RoomEncryptionSettings.vue'

/**
 * 房间加密设置面板的四态边界。
 *
 * 关键回归点：读取加密状态失败时**不能**落到「未加密」分支。
 * 否则用户会以为房间可以加密，点「启用加密」才在服务层失败。
 */

const { isRoomEncryptedMock, getEncryptionSettingsMock, enableRoomEncryptionMock, showFeedbackMock } = vi.hoisted(
  () => ({
    isRoomEncryptedMock: vi.fn(),
    getEncryptionSettingsMock: vi.fn(),
    enableRoomEncryptionMock: vi.fn(),
    showFeedbackMock: vi.fn()
  })
)

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />',
    props: ['icon', 'width', 'color']
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/encryption', () => ({
  useEncryption: () => ({
    isRoomEncrypted: isRoomEncryptedMock,
    getEncryptionSettings: getEncryptionSettingsMock,
    enableRoomEncryption: enableRoomEncryptionMock
  })
}))

const mountComponent = (roomId = '!room-1:server') =>
  mount(RoomEncryptionSettings, {
    props: { roomId },
    global: {
      stubs: {
        'n-card': { template: '<div><slot name="header" /><slot /></div>' },
        'n-flex': { template: '<div><slot /></div>' },
        'n-spin': { template: '<div><slot /></div>' },
        'n-button': true,
        'n-descriptions': { template: '<div><slot /></div>' },
        'n-descriptions-item': true,
        'n-tag': { template: '<span><slot /></span>' }
      }
    }
  })

describe('RoomEncryptionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isRoomEncryptedMock.mockResolvedValue(false)
    getEncryptionSettingsMock.mockResolvedValue(null)
    enableRoomEncryptionMock.mockResolvedValue(undefined)
  })

  it('读取成功且未加密时显示未加密空态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-test="encryption-error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('encryption.room_settings.not_encrypted')
  })

  it('读取失败时显示错误态与重试，不显示「未加密」', async () => {
    isRoomEncryptedMock.mockRejectedValue(new Error('offline'))
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-test="encryption-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="encryption-retry"]').exists()).toBe(true)
    // 未知状态不能渲染成「未加密」，否则会误导用户点启用加密
    expect(wrapper.text()).not.toContain('encryption.room_settings.not_encrypted')
  })

  it('错误态点击重试后恢复真实状态', async () => {
    isRoomEncryptedMock.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountComponent()
    await flushPromises()
    expect(wrapper.find('[data-test="encryption-error"]').exists()).toBe(true)

    isRoomEncryptedMock.mockResolvedValueOnce(true)
    getEncryptionSettingsMock.mockResolvedValueOnce({
      algorithm: 'm.megolm.v1.aes-sha2',
      rotationPeriodMs: 604800000,
      rotationPeriodMsgs: 100
    })
    await wrapper.find('[data-test="encryption-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="encryption-error"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('encryption.room_settings.encrypted')
    expect(wrapper.text()).toContain('m.megolm.v1.aes-sha2')
  })
})
