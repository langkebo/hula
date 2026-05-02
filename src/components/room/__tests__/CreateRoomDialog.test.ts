import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CreateRoomDialog from '../CreateRoomDialog.vue'

const {
  validateMock,
  createGroupRoomMock,
  getServerDomainMock,
  uploadFileMock,
  loggerErrorMock,
  messageSuccessMock,
  messageErrorMock
} = vi.hoisted(() => ({
  validateMock: vi.fn(),
  createGroupRoomMock: vi.fn(),
  getServerDomainMock: vi.fn(),
  uploadFileMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock
  }))
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadFile: uploadFileMock
  }
}))

vi.mock('@/services/matrix/room/RoomNavigationService', () => ({
  roomNavigationService: {
    createGroupRoom: createGroupRoomMock,
    getServerDomain: getServerDomainMock
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthroughStub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  const NModal = defineComponent({
    name: 'NModal',
    props: {
      show: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:show'],
    setup(props, { slots, emit }) {
      return () =>
        props.show
          ? h('div', { 'data-test': 'modal' }, [
              h(
                'button',
                {
                  type: 'button',
                  'data-test': 'modal-update-show',
                  onClick: () => emit('update:show', false)
                },
                'toggle'
              ),
              slots.default?.(),
              slots.footer?.()
            ])
          : null
    }
  })

  const NForm = defineComponent({
    name: 'NForm',
    setup(_, { slots, expose }) {
      expose({
        validate: validateMock
      })

      return () => h('form', slots.default?.())
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            onClick: () => emit('click')
          },
          slots.default?.()
        )
    }
  })

  const NAvatar = defineComponent({
    name: 'NAvatar',
    props: {
      src: {
        type: String,
        default: ''
      }
    },
    setup(props) {
      return () => h('img', { 'data-test': 'avatar', src: props.src })
    }
  })

  const NUpload = defineComponent({
    name: 'NUpload',
    props: {
      customRequest: {
        type: Function,
        required: false
      }
    },
    setup(props, { slots }) {
      return () =>
        h('div', { 'data-test': 'upload' }, [
          h(
            'button',
            {
              type: 'button',
              'data-test': 'upload-trigger',
              onClick: () =>
                props.customRequest?.({
                  file: {
                    file: new File(['avatar'], 'avatar.png', { type: 'image/png' })
                  }
                })
            },
            'upload'
          ),
          slots.default?.()
        ])
    }
  })

  return {
    NModal,
    NForm,
    NFormItem: passthroughStub('NFormItem'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'n-input',
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NInputGroup: passthroughStub('NInputGroup'),
    NInputGroupLabel: passthroughStub('NInputGroupLabel'),
    NRadioGroup: defineComponent({
      name: 'NRadioGroup',
      props: {
        value: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:value'],
      setup(props, { slots, emit }) {
        return () =>
          h('div', { 'data-test': 'NRadioGroup' }, [
            h(
              'button',
              {
                type: 'button',
                'data-test': 'radio-group-toggle',
                onClick: () => emit('update:value', !props.value)
              },
              'toggle-radio'
            ),
            slots.default?.()
          ])
      }
    }),
    NRadio: passthroughStub('NRadio'),
    NSwitch: passthroughStub('NSwitch'),
    NSelect: defineComponent({
      name: 'NSelect',
      emits: ['update:value'],
      setup(_, { emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'history-select',
              onClick: () => emit('update:value', 'joined')
            },
            'select-history'
          )
      }
    }),
    NUpload,
    NAvatar,
    NButton
  }
})

const mountDialog = (visible = true) =>
  mount(CreateRoomDialog, {
    props: {
      visible
    }
  })

type DialogVM = {
  formData: {
    name: string
    topic: string
    alias: string
    avatarUrl: string
    isPublic: boolean
    isEncrypted: boolean
    historyVisibility: string
  }
  creating: boolean
}

const getVm = (wrapper: ReturnType<typeof mountDialog>) => wrapper.vm as unknown as DialogVM

const getCreateButton = (wrapper: ReturnType<typeof mountDialog>) => {
  const button = wrapper.findAll('button').find((item) => item.text().includes('room.create.create'))
  if (!button) {
    throw new Error('创建按钮不存在')
  }

  return button
}

describe('CreateRoomDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateMock.mockResolvedValue(undefined)
    createGroupRoomMock.mockResolvedValue({ roomId: '!new:example.com' })
    getServerDomainMock.mockResolvedValue('example.com')
    uploadFileMock.mockResolvedValue({ contentUri: 'mxc://server/avatar' })
    ;(window as any).$message = {
      success: messageSuccessMock,
      error: messageErrorMock
    }
  })

  it('显示公开房间别名时使用服务层提供的 homeserver 域名', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.isPublic = true
    await nextTick()

    expect(getServerDomainMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain(':example.com')
  })

  it('支持通过表单事件更新公开房间相关字段并响应弹窗显隐事件', async () => {
    const wrapper = mountDialog()

    await flushPromises()
    await wrapper.get('[data-test="radio-group-toggle"]').trigger('click')
    await nextTick()

    const inputs = wrapper.findAll('[data-test="n-input"]')
    await inputs[1].setValue('Updated Topic')
    await inputs[2].setValue('updated-alias')
    await wrapper.get('[data-test="history-select"]').trigger('click')
    await wrapper.get('[data-test="modal-update-show"]').trigger('click')
    await nextTick()

    expect(getVm(wrapper).formData.isPublic).toBe(true)
    expect(getVm(wrapper).formData.topic).toBe('Updated Topic')
    expect(getVm(wrapper).formData.alias).toBe('updated-alias')
    expect(getVm(wrapper).formData.historyVisibility).toBe('joined')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('获取 homeserver 域名失败时回退到 matrix.org', async () => {
    getServerDomainMock.mockRejectedValueOnce(new Error('domain failed'))
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.isPublic = true
    await nextTick()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain(':matrix.org')
  })

  it('上传头像成功后写入 avatarUrl', async () => {
    const wrapper = mountDialog()

    await flushPromises()
    await wrapper.get('[data-test="upload-trigger"]').trigger('click')
    await flushPromises()

    expect(uploadFileMock).toHaveBeenCalledTimes(1)
    expect(getVm(wrapper).formData.avatarUrl).toBe('mxc://server/avatar')
  })

  it('上传头像失败时提示错误消息', async () => {
    uploadFileMock.mockRejectedValueOnce(new Error('upload failed'))
    const wrapper = mountDialog()

    await flushPromises()
    await wrapper.get('[data-test="upload-trigger"]').trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(messageErrorMock).toHaveBeenCalledWith('room.create.avatar_upload_failed')
  })

  it('创建公开加密房间时通过服务层组装参数并在成功后重置表单', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'Public Room'
    getVm(wrapper).formData.topic = 'Topic'
    getVm(wrapper).formData.alias = 'public-room'
    getVm(wrapper).formData.avatarUrl = 'mxc://server/avatar'
    getVm(wrapper).formData.isPublic = true
    getVm(wrapper).formData.isEncrypted = true
    getVm(wrapper).formData.historyVisibility = 'invited'
    await nextTick()

    await getCreateButton(wrapper).trigger('click')
    await flushPromises()

    expect(validateMock).toHaveBeenCalledTimes(1)
    expect(createGroupRoomMock).toHaveBeenCalledWith({
      name: 'Public Room',
      topic: 'Topic',
      avatarUrl: 'mxc://server/avatar',
      isPublic: true,
      alias: 'public-room',
      isEncrypted: true,
      historyVisibility: 'invited'
    })
    expect(messageSuccessMock).toHaveBeenCalledWith('room.create.success')
    expect(wrapper.emitted('created')).toEqual([['!new:example.com']])
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(getVm(wrapper).formData.name).toBe('')
    expect(getVm(wrapper).formData.alias).toBe('')
    expect(getVm(wrapper).formData.isEncrypted).toBe(false)
    expect(getVm(wrapper).formData.historyVisibility).toBe('shared')
  })

  it('表单校验失败时不会调用创建接口', async () => {
    validateMock.mockRejectedValueOnce(new Error('invalid form'))
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'x'
    await nextTick()

    await getCreateButton(wrapper).trigger('click')
    await flushPromises()

    expect(createGroupRoomMock).not.toHaveBeenCalled()
  })

  it('创建失败时提示错误并关闭 loading 状态', async () => {
    createGroupRoomMock.mockRejectedValueOnce(new Error('create failed'))
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'Private Room'
    await nextTick()

    await getCreateButton(wrapper).trigger('click')
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(messageErrorMock).toHaveBeenCalledWith('room.create.failed')
    expect(getVm(wrapper).creating).toBe(false)
  })

  it('关闭弹窗时重置表单', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'Will Reset'
    getVm(wrapper).formData.alias = 'reset-me'
    getVm(wrapper).formData.isPublic = true
    await nextTick()

    await wrapper.setProps({ visible: false })
    await nextTick()

    expect(getVm(wrapper).formData.name).toBe('')
    expect(getVm(wrapper).formData.alias).toBe('')
    expect(getVm(wrapper).formData.isPublic).toBe(false)
  })
})
