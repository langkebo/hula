import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import LinkPreviewPane from '../LinkPreviewPane.vue'

const { getUrlPreviewMock, isRoomEncryptedMock } = vi.hoisted(() => ({
  getUrlPreviewMock: vi.fn(),
  isRoomEncryptedMock: vi.fn()
}))

const settingStore = reactive({
  linkPreviewEnabled: true
})

const currentSessionRoomId = '!room:test'

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: isRoomEncryptedMock }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', () => {
  const NDrawer = defineComponent({
    name: 'NDrawer',
    props: { show: { type: Boolean, default: false } },
    emits: ['update:show'],
    setup(props, { slots }) {
      return () => (props.show ? h('div', { class: 'mock-drawer' }, slots.default?.()) : null)
    }
  })
  const NDrawerContent = defineComponent({
    name: 'NDrawerContent',
    setup(_, { slots }) {
      return () => h('div', [slots.default?.(), slots.footer?.()])
    }
  })
  const NInput = defineComponent({
    name: 'NInput',
    props: { value: { type: String, default: '' } },
    emits: ['update:value', 'blur', 'keydown'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          value: props.value,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value),
          onBlur: () => emit('blur')
        })
    }
  })
  const NButton = defineComponent({
    name: 'NButton',
    props: { disabled: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => h('button', { disabled: props.disabled }, slots.default?.())
    }
  })
  return { NButton, NDrawer, NDrawerContent, NInput }
})

vi.mock('@/common/constants', () => ({
  THUMBNAIL_SIZE_LINK_PREVIEW: 96
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    getUrlPreview: getUrlPreviewMock,
    getMediaUrl: (url: string) => url
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStore
}))

type PaneVm = {
  url: string
  preview: unknown
  fetchFailed: boolean
  isValidUrl: boolean
  handleFetch: () => Promise<void>
  handleSubmit: () => Promise<void>
}

const mountPane = () => mount(LinkPreviewPane, { props: { show: true } })

const vmOf = (wrapper: ReturnType<typeof mountPane>) => wrapper.vm as unknown as PaneVm

describe('LinkPreviewPane', () => {
  beforeEach(() => {
    settingStore.linkPreviewEnabled = true
    getUrlPreviewMock.mockReset()
    isRoomEncryptedMock.mockReset()
    isRoomEncryptedMock.mockResolvedValue(false)
  })

  it('rejects invalid urls without sending', async () => {
    const wrapper = mountPane()

    vmOf(wrapper).url = 'not a url'
    await flushPromises()

    expect(vmOf(wrapper).isValidUrl).toBe(false)

    await vmOf(wrapper).handleSubmit()
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('normalizes the url before fetching a preview', async () => {
    getUrlPreviewMock.mockResolvedValue({
      url: 'https://example.com/a',
      title: 'Example'
    })
    const wrapper = mountPane()

    vmOf(wrapper).url = 'example.com/a'
    await vmOf(wrapper).handleFetch()
    await flushPromises()

    expect(getUrlPreviewMock).toHaveBeenCalledWith('https://example.com/a')
    expect(vmOf(wrapper).preview).toEqual({ url: 'https://example.com/a', title: 'Example' })
    wrapper.unmount()
  })

  it('加密房间不请求服务端预览', async () => {
    isRoomEncryptedMock.mockResolvedValueOnce(true)
    const wrapper = mountPane()
    await wrapper.find('input').setValue('https://example.com/a')
    await wrapper.find('[data-test="link-preview-fetch"]').trigger('click')
    await flushPromises()

    expect(getUrlPreviewMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('chat.link_preview.blocked_encrypted')
    wrapper.unmount()
  })

  it('sends the fetched preview on submit', async () => {
    const preview = {
      url: 'https://example.com/a',
      title: 'Example',
      description: 'Example description',
      imageUrl: 'mxc://hs.test/thumb'
    }
    getUrlPreviewMock.mockResolvedValue(preview)
    const wrapper = mountPane()

    vmOf(wrapper).url = 'https://example.com/a'
    await vmOf(wrapper).handleSubmit()
    await flushPromises()

    expect(wrapper.emitted('submit')?.[0]).toEqual([preview])
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
    wrapper.unmount()
  })

  it('falls back to the raw url when the preview cannot be fetched', async () => {
    getUrlPreviewMock.mockResolvedValue(null)
    const wrapper = mountPane()

    vmOf(wrapper).url = 'example.com/a'
    await vmOf(wrapper).handleSubmit()
    await flushPromises()

    expect(vmOf(wrapper).fetchFailed).toBe(true)
    expect(wrapper.emitted('submit')?.[0]).toEqual([{ url: 'https://example.com/a', title: 'https://example.com/a' }])
    wrapper.unmount()
  })

  it('hides the form when link preview is disabled in settings', async () => {
    settingStore.linkPreviewEnabled = false
    const wrapper = mountPane()
    await flushPromises()

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toContain('chat.link_preview.disabled')
    wrapper.unmount()
  })
})
