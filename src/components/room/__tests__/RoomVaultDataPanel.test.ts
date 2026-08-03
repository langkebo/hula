import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomVaultDataPanel from '../RoomVaultDataPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getVaultDataMock = vi.fn()
const setVaultDataMock = vi.fn()

vi.mock('@/services/matrix/room/AccountDataService', () => ({
  matrixRoomAccountDataService: {
    getVaultData: (...args: unknown[]) => getVaultDataMock(...args),
    setVaultData: (...args: unknown[]) => setVaultDataMock(...args)
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header"><slot name="header" /></div><div class="n-card-body"><slot /></div></div>',
    props: ['size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Empty: { template: '<div class="n-empty"><slot /></div>', props: ['description', 'size'] },
  Button: {
    template: '<button class="n-button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type', 'size', 'block', 'secondary'],
    emits: ['click']
  },
  Input: {
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'type', 'placeholder', 'rows', 'disabled'],
    emits: ['update:value']
  },
  Descriptions: {
    template: '<div class="n-descriptions"><slot /></div>',
    props: ['bordered', 'column', 'labelPlacement', 'size']
  },
  DescriptionsItem: {
    template:
      '<div class="n-descriptions-item"><span class="n-descriptions-label">{{ label }}</span><span class="n-descriptions-content"><slot /></span></div>',
    props: ['label']
  }
}

describe('RoomVaultDataPanel — P2-4 房间 Vault 数据管理面板', () => {
  beforeEach(() => {
    getVaultDataMock.mockReset()
    setVaultDataMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = async () => {
    const wrapper = mount(RoomVaultDataPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('挂载时调用 getVaultData 加载 Vault 数据', async () => {
    getVaultDataMock.mockResolvedValue({ custom_key: 'custom_value' })
    await mountPanel()
    expect(getVaultDataMock).toHaveBeenCalledWith('!room:hs')
  })

  it('加载中显示 loading 状态', () => {
    getVaultDataMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(RoomVaultDataPanel, {
      props: { roomId: '!room:hs' },
      global: { stubs: naiveStubs }
    })
    expect(wrapper.find('.n-spin').exists()).toBe(true)
  })

  it('有数据时以 descriptions 形式展示 Vault 键值对', async () => {
    getVaultDataMock.mockResolvedValue({ key1: 'value1', key2: 'value2' })
    const wrapper = await mountPanel()
    const items = wrapper.findAll('.n-descriptions-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('key1')
    expect(wrapper.text()).toContain('value1')
  })

  it('空数据时显示空状态提示', async () => {
    getVaultDataMock.mockResolvedValue({})
    const wrapper = await mountPanel()
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('点击保存按钮调用 setVaultData 并显示成功反馈', async () => {
    getVaultDataMock.mockResolvedValue({ existing: 'data' })
    setVaultDataMock.mockResolvedValue(undefined)
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="vault-edit-btn"]').trigger('click')
    await wrapper.find('[data-testid="vault-save-btn"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(setVaultDataMock).toHaveBeenCalledWith('!room:hs', expect.any(Object))
    expect(showFeedbackMock).toHaveBeenCalledWith('room.vault.save_success', 'success')
  })
})
