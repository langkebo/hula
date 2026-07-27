import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import CreateSpacePane from '../CreateSpacePane.vue'

// === Mocks ===
const {
  createSpaceMock,
  uploadFileMock,
  showFeedbackMock,
  routerReplaceMock,
  buildSpaceWorkbenchRouteMock,
  formValidateMock
} = vi.hoisted(() => ({
  createSpaceMock: vi.fn(),
  uploadFileMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  routerReplaceMock: vi.fn(),
  buildSpaceWorkbenchRouteMock: vi.fn((spaceId: string) => `/space/${spaceId}`),
  formValidateMock: vi.fn().mockResolvedValue(true)
}))

// draftData 必须在 vi.hoisted 外部声明（reactive 在 hoisting 阶段不可用）
const draftData = reactive({ name: '', topic: '', avatarUrl: '' })

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/space', () => ({
  useSpaces: () => ({ create: createSpaceMock }),
  SpaceInfo: {}
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { uploadFile: uploadFileMock }
}))

vi.mock('@/stores/domains/widget/rightViewDraft', () => ({
  useRightViewDraftStore: () => ({
    // Pinia setup store 自动解包 ref，mock 中直接返回 reactive 对象模拟此行为
    createSpace: draftData,
    saveCreateSpace: vi.fn((patch: Partial<typeof draftData>) => {
      Object.assign(draftData, patch)
    }),
    clearCreateSpace: vi.fn(() => {
      draftData.name = ''
      draftData.topic = ''
      draftData.avatarUrl = ''
    }),
    restoredHint: null,
    setRestoredHint: vi.fn()
  })
}))

vi.mock('@/router/spaceNavigation', () => ({
  buildSpaceWorkbenchRoute: buildSpaceWorkbenchRouteMock
}))

vi.mock('@/router', () => ({
  default: { replace: routerReplaceMock, push: vi.fn(), back: vi.fn() }
}))

// Mock naive-ui: NForm exposes validate() via ref
vi.mock('naive-ui', () => {
  return {
    NForm: defineComponent({
      name: 'NForm',
      props: { model: Object, rules: Object, labelPlacement: String, labelWidth: [String, Number] },
      setup(_, { slots }) {
        return () => h('form', { class: 'n-form' }, [slots.default?.()])
      },
      methods: { validate: formValidateMock }
    }),
    NFormItem: defineComponent({
      name: 'NFormItem',
      props: { label: String, path: String },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-form-item' }, [h('label', _.label), slots.default?.()])
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' },
        placeholder: String,
        type: { type: String, default: 'text' }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('textarea', {
            class: 'n-input',
            value: props.value,
            placeholder: props.placeholder,
            onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: { type: String, loading: Boolean, size: String },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`],
              disabled: props.loading,
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.default?.()]
          )
      }
    }),
    NScrollbar: defineComponent({
      name: 'NScrollbar',
      setup(_, { slots }) {
        return () => h('div', { class: 'n-scrollbar' }, [slots.default?.()])
      }
    }),
    NUpload: defineComponent({
      name: 'NUpload',
      props: { max: Number, accept: String, showFileList: Boolean },
      setup(_, { slots }) {
        return () => h('div', { class: 'n-upload' }, [slots.default?.()])
      }
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: { src: String, size: Number, round: Boolean },
      setup(props) {
        return () => h('span', { class: 'n-avatar', 'data-src': props.src || '' }, 'avatar')
      }
    })
  }
})

// === Fixtures ===
const mountPane = () => mount(CreateSpacePane)

const setFormData = async (wrapper: ReturnType<typeof mountPane>, name: string, topic = '') => {
  const inputs = wrapper.findAll('.n-input')
  await inputs[0].setValue(name)
  await inputs[1].setValue(topic)
  await wrapper.vm.$nextTick()
}

describe('CreateSpacePane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draftData.name = ''
    draftData.topic = ''
    draftData.avatarUrl = ''
    formValidateMock.mockResolvedValue(true)
    createSpaceMock.mockResolvedValue({
      spaceId: '!new-space:server',
      name: 'New Space',
      memberCount: 1,
      childCount: 0
    })
    uploadFileMock.mockResolvedValue({ contentUri: 'mxc://server/media/123' })
  })

  // (a) 渲染
  it('renders the create space form with name, topic and avatar fields', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.create-space-pane').exists()).toBe(true)
    expect(wrapper.findAll('.n-form-item')).toHaveLength(3)
    expect(wrapper.find('button.n-button--primary').exists()).toBe(true)
  })

  // (b) 输入 name + topic
  it('binds name and topic inputs to form data', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space', 'A topic')

    const vm = wrapper.vm as unknown as { formData: { name: string; topic: string; avatarUrl: string } }
    expect(vm.formData.name).toBe('My Space')
    expect(vm.formData.topic).toBe('A topic')
  })

  // (c) 提交调用 useSpaces().create
  it('calls createSpace on submit with form data', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space', 'A topic')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(createSpaceMock).toHaveBeenCalledWith({
      name: 'My Space',
      topic: 'A topic',
      avatarUrl: ''
    })
  })

  // (e) 成功后跳转 spaceChildren (via buildSpaceWorkbenchRoute)
  it('navigates to space workbench on successful create', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(buildSpaceWorkbenchRouteMock).toHaveBeenCalledWith('!new-space:server')
    expect(routerReplaceMock).toHaveBeenCalledWith('/space/!new-space:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_success', 'success')
  })

  it('clears draft on successful create', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space', 'Topic')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(draftData.name).toBe('')
    expect(draftData.topic).toBe('')
  })

  // (f) 错误 Toast
  it('shows error toast when createSpace rejects', async () => {
    createSpaceMock.mockRejectedValue(new Error('network'))
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_failed', 'error')
  })

  it('shows error toast when createSpace returns null', async () => {
    createSpaceMock.mockResolvedValue(null)
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('space.create_failed', 'error')
    expect(routerReplaceMock).not.toHaveBeenCalled()
  })

  // 表单校验失败不提交
  it('does not call createSpace when form validation fails', async () => {
    formValidateMock.mockRejectedValue(new Error('validation failed'))
    const wrapper = mountPane()
    await setFormData(wrapper, 'My Space')
    await wrapper.find('button.n-button--primary').trigger('click')
    await flushPromises()

    expect(createSpaceMock).not.toHaveBeenCalled()
  })

  // (d) 草稿恢复
  it('restores draft from store on mount and shows hint', async () => {
    draftData.name = 'Draft Space'
    draftData.topic = 'Draft topic'
    draftData.avatarUrl = 'mxc://server/draft'
    const wrapper = mountPane()
    await flushPromises()

    const vm = wrapper.vm as unknown as { formData: { name: string; topic: string; avatarUrl: string } }
    expect(vm.formData.name).toBe('Draft Space')
    expect(vm.formData.topic).toBe('Draft topic')
    expect(vm.formData.avatarUrl).toBe('mxc://server/draft')
    expect(wrapper.find('.create-space-pane__hint').exists()).toBe(true)
  })

  it('does not show restored hint when no draft exists', () => {
    const wrapper = mountPane()
    expect(wrapper.find('.create-space-pane__hint').exists()).toBe(false)
  })

  // 自动同步草稿
  it('saves draft to store when form data changes', async () => {
    const wrapper = mountPane()
    await setFormData(wrapper, 'Sync Space', 'sync topic')
    await flushPromises()

    expect(draftData.name).toBe('Sync Space')
    expect(draftData.topic).toBe('sync topic')
  })

  // 头像上传
  it('uploads avatar and sets avatarUrl on upload success', async () => {
    const wrapper = mountPane()
    const vm = wrapper.vm as unknown as {
      formData: { name: string; topic: string; avatarUrl: string }
      handleAvatarUpload: (opts: unknown) => Promise<void>
    }
    const opts = {
      file: { file: new File(['data'], 'avatar.png', { type: 'image/png' }) },
      onFinish: vi.fn(),
      onError: vi.fn()
    }
    await vm.handleAvatarUpload(opts)
    await flushPromises()

    expect(uploadFileMock).toHaveBeenCalled()
    expect(vm.formData.avatarUrl).toBe('mxc://server/media/123')
    expect(opts.onFinish).toHaveBeenCalled()
  })

  it('calls onError when avatar upload fails', async () => {
    uploadFileMock.mockRejectedValue(new Error('upload failed'))
    const wrapper = mountPane()
    const vm = wrapper.vm as unknown as { handleAvatarUpload: (opts: unknown) => Promise<void> }
    const opts = {
      file: { file: new File(['data'], 'avatar.png', { type: 'image/png' }) },
      onFinish: vi.fn(),
      onError: vi.fn()
    }
    await vm.handleAvatarUpload(opts)
    await flushPromises()

    expect(opts.onError).toHaveBeenCalled()
  })
})
