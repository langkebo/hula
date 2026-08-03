import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContactDetailPanel from '../ContactDetailPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const getDisplayNameMock = vi.fn()
const getAvatarUrlMock = vi.fn()
vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  default: {
    getDisplayName: (...args: unknown[]) => getDisplayNameMock(...args),
    getAvatarUrl: (...args: unknown[]) => getAvatarUrlMock(...args)
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: ''
  })
}))

const naiveStubs = {
  Drawer: {
    template: '<div class="n-drawer-stub" v-if="show"><slot /><slot name="header" /></div>',
    props: ['show', 'width', 'placement']
  },
  DrawerContent: {
    template: '<div class="n-drawer-content-stub"><slot /><slot name="title" /></div>',
    props: ['title', 'closable']
  },
  Avatar: { template: '<div class="n-avatar-stub" />', props: ['size', 'src', 'round'] },
  Divider: { template: '<hr class="n-divider-stub" />' },
  Button: {
    template:
      '<button class="n-button-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
    props: ['disabled', 'loading', 'type', 'block', 'secondary'],
    emits: ['click']
  },
  Empty: { template: '<div class="n-empty-stub"><slot /></div>', props: ['description'] },
  Modal: {
    template: '<div class="n-modal-stub" v-if="show"><slot /><slot name="footer" /></div>',
    props: ['show']
  },
  Select: {
    template:
      '<select class="n-select-stub" :disabled="disabled" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value="" disabled></option><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['value', 'options', 'disabled', 'placeholder'],
    emits: ['update:value']
  },
  Input: {
    template: '<textarea class="n-input-stub" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'rows', 'placeholder'],
    emits: ['update:value']
  },
  Form: { template: '<form class="n-form-stub"><slot /></form>' },
  FormItem: { template: '<div class="n-form-item-stub"><slot /></div>', props: ['label'] },
  Icon: { name: 'Icon', template: '<span class="icon-stub" />' }
}

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<span class="icon-stub" />' }
}))

describe('ContactDetailPanel — 举报用户入口 (P0-2)', () => {
  beforeEach(() => {
    getDisplayNameMock.mockReset()
    getAvatarUrlMock.mockReset()
  })

  const mountPanel = async (userId = '@bad:hs') => {
    getDisplayNameMock.mockResolvedValue('Bad User')
    getAvatarUrlMock.mockResolvedValue('mxc://avatar')
    const wrapper = mount(ContactDetailPanel, {
      props: { visible: true, userId },
      global: { stubs: naiveStubs }
    })
    // 等待 watch 异步加载 profile
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('profile 加载完成后渲染「举报用户」按钮', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="contact-report-btn"]').exists()).toBe(true)
  })

  it('点击「举报用户」按钮打开 UserReportDialog', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-testid="contact-report-btn"]').trigger('click')
    expect(wrapper.find('.n-modal-stub').exists()).toBe(true)
  })

  it('UserReportDialog 接收正确的 userId 和 displayName', async () => {
    const wrapper = await mountPanel('@spammer:hs')
    await wrapper.find('[data-testid="contact-report-btn"]').trigger('click')
    const dialog = wrapper.findComponent({ name: 'UserReportDialog' })
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('userId')).toBe('@spammer:hs')
    expect(dialog.props('userDisplayName')).toBe('Bad User')
  })
})
