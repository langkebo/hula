import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecurityTab from '../SecurityTab.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mocks = vi.hoisted(() => ({
  showFeedback: vi.fn(),
  isRoomEncrypted: vi.fn(),
  getEncryptionSettings: vi.fn(),
  enableRoomEncryption: vi.fn(),
  getRoomVisibility: vi.fn(),
  setRoomVisibility: vi.fn(),
  getVaultData: vi.fn(),
  setVaultData: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('@/composables/encryption/useEncryption', () => ({
  useEncryption: () => ({
    isRoomEncrypted: mocks.isRoomEncrypted,
    getEncryptionSettings: mocks.getEncryptionSettings,
    enableRoomEncryption: mocks.enableRoomEncryption
  })
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getVaultData: mocks.getVaultData },
  matrixRoomActionFacade: {
    getRoomVisibility: mocks.getRoomVisibility,
    setRoomVisibility: mocks.setRoomVisibility,
    setVaultData: mocks.setVaultData
  }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" />', props: ['size'] },
  Switch: {
    template: '<button class="n-switch" />',
    props: ['value', 'disabled', 'loading'],
    emits: ['update:value']
  },
  Input: {
    template:
      '<textarea class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)"></textarea>',
    props: ['value', 'type', 'rows', 'placeholder', 'readonly'],
    emits: ['update:value']
  },
  Button: {
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>',
    props: ['size', 'type', 'loading'],
    emits: ['click']
  }
}

const VAULT_INPUT = '[data-testid="security-vault-input"]'
const VAULT_SAVE = '[data-testid="security-vault-save"]'

describe('SecurityTab — 房间保险库编辑', () => {
  beforeEach(() => {
    mocks.showFeedback.mockReset()
    mocks.isRoomEncrypted.mockReset().mockResolvedValue(false)
    mocks.getEncryptionSettings.mockReset().mockResolvedValue(null)
    mocks.enableRoomEncryption.mockReset().mockResolvedValue(undefined)
    mocks.getRoomVisibility.mockReset().mockResolvedValue('private')
    mocks.setRoomVisibility.mockReset().mockResolvedValue(undefined)
    mocks.getVaultData.mockReset().mockResolvedValue({})
    mocks.setVaultData.mockReset().mockResolvedValue(undefined)
  })

  const mountTab = async (roomId = '!room:hs') => {
    const wrapper = mount(SecurityTab, {
      props: { roomId },
      global: { stubs: naiveStubs }
    })
    await flushPromises()
    return wrapper
  }

  const setVaultDraft = async (wrapper: Awaited<ReturnType<typeof mountTab>>, value: string) => {
    await wrapper.find(VAULT_INPUT).setValue(value)
  }

  it('挂载时以 throwOnError=true 读取保险库并回填格式化 JSON', async () => {
    mocks.getVaultData.mockResolvedValue({ secret: 'v' })
    const wrapper = await mountTab()

    expect(mocks.getVaultData).toHaveBeenCalledWith('!room:hs', true)
    expect((wrapper.find(VAULT_INPUT).element as HTMLInputElement).value).toBe(JSON.stringify({ secret: 'v' }, null, 2))
  })

  it('保险库读取失败时展示局部失败信号且不回退为空对象', async () => {
    mocks.getVaultData.mockRejectedValue(new Error('boom'))
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="security-vault-partial"]').exists()).toBe(true)
    expect((wrapper.find(VAULT_INPUT).element as HTMLInputElement).value).toBe('')
  })

  it('保险库读取失败后重试成功时填充数据并移除局部失败信号', async () => {
    mocks.getVaultData.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountTab()
    expect(wrapper.find('[data-testid="security-vault-partial"]').exists()).toBe(true)

    mocks.getVaultData.mockResolvedValue({ retried: true })
    await wrapper.find('[data-testid="security-vault-partial"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="security-vault-partial"]').exists()).toBe(false)
    expect((wrapper.find(VAULT_INPUT).element as HTMLInputElement).value).toBe(
      JSON.stringify({ retried: true }, null, 2)
    )
  })

  it('安全设置读取失败时展示局部失败信号并隐藏状态字段', async () => {
    mocks.isRoomEncrypted.mockRejectedValue(new Error('boom'))
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="security-status-partial"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="security-enable-e2ee-switch"]').exists()).toBe(false)
  })

  it('安全设置读取失败后重试成功时恢复状态字段', async () => {
    mocks.isRoomEncrypted.mockRejectedValueOnce(new Error('boom'))
    const wrapper = await mountTab()
    expect(wrapper.find('[data-testid="security-status-partial"]').exists()).toBe(true)

    await wrapper.find('[data-testid="security-status-partial"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="security-status-partial"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="security-enable-e2ee-switch"]').exists()).toBe(true)
  })

  it('保存合法对象时调用 setVaultData 并提示成功', async () => {
    const wrapper = await mountTab()
    await setVaultDraft(wrapper, '{"a":1}')

    await wrapper.find(VAULT_SAVE).trigger('click')
    await flushPromises()

    expect(mocks.setVaultData).toHaveBeenCalledWith('!room:hs', { a: 1 })
    expect(mocks.showFeedback).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')
  })

  it('非法 JSON 时提示错误且不发起保存', async () => {
    const wrapper = await mountTab()
    await setVaultDraft(wrapper, 'not-json')

    await wrapper.find(VAULT_SAVE).trigger('click')
    await flushPromises()

    expect(mocks.setVaultData).not.toHaveBeenCalled()
    expect(mocks.showFeedback).toHaveBeenCalledWith('room.settings_drawer.vault_invalid_json', 'error')
  })

  it('JSON 为数组时提示错误且不发起保存', async () => {
    const wrapper = await mountTab()
    await setVaultDraft(wrapper, '[1,2]')

    await wrapper.find(VAULT_SAVE).trigger('click')
    await flushPromises()

    expect(mocks.setVaultData).not.toHaveBeenCalled()
    expect(mocks.showFeedback).toHaveBeenCalledWith('room.settings_drawer.vault_invalid_json', 'error')
  })

  it('保存失败时提示错误', async () => {
    mocks.setVaultData.mockRejectedValue(new Error('HTTP 403'))
    const wrapper = await mountTab()
    await setVaultDraft(wrapper, '{"a":1}')

    await wrapper.find(VAULT_SAVE).trigger('click')
    await flushPromises()

    expect(mocks.showFeedback).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
  })
})
