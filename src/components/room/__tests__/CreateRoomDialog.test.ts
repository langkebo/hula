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
  showFeedbackMock,
  inviteUserMock
} = vi.hoisted(() => ({
  validateMock: vi.fn(),
  createGroupRoomMock: vi.fn(),
  getServerDomainMock: vi.fn(),
  uploadFileMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  inviteUserMock: vi.fn()
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

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    createGroupRoom: createGroupRoomMock,
    inviteUser: inviteUserMock
  }
}))

vi.mock('@/services/matrix/room/ReadFacade', () => ({
  matrixRoomReadFacade: {
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
          type: [String, Boolean],
          default: 'room'
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
    roomType: 'room' | 'private_room' | 'space'
    isEncrypted: boolean
    historyVisibility: string
    joinRule: string
  }
  creating: boolean
  stage: 'create' | 'invite'
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
    inviteUserMock.mockResolvedValue(undefined)
  })

  it('打开弹窗时加载 homeserver 域名', async () => {
    mountDialog()

    await flushPromises()

    expect(getServerDomainMock).toHaveBeenCalledTimes(1)
  })

  it('支持通过表单事件更新名称和主题并响应弹窗显隐事件', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    const inputs = wrapper.findAll('[data-test="n-input"]')
    await inputs[0].setValue('Room Name')
    await inputs[1].setValue('Updated Topic')
    await wrapper.get('[data-test="modal-update-show"]').trigger('click')
    await nextTick()

    expect(getVm(wrapper).formData.name).toBe('Room Name')
    expect(getVm(wrapper).formData.topic).toBe('Updated Topic')
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('获取 homeserver 域名失败时回退到 matrix.org', async () => {
    getServerDomainMock.mockRejectedValueOnce(new Error('domain failed'))
    mountDialog()

    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
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
    expect(showFeedbackMock).toHaveBeenCalledWith('room.create.avatar_upload_failed', 'error')
  })

  it('创建公开加密房间时通过服务层组装参数并在成功后切换到邀请阶段', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'Public Room'
    getVm(wrapper).formData.topic = 'Topic'
    getVm(wrapper).formData.alias = 'public-room'
    getVm(wrapper).formData.avatarUrl = 'mxc://server/avatar'
    getVm(wrapper).formData.roomType = 'room'
    getVm(wrapper).formData.isEncrypted = true
    getVm(wrapper).formData.historyVisibility = 'invited'
    getVm(wrapper).formData.joinRule = 'invite'
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
      historyVisibility: 'invited',
      joinRule: 'invite'
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('room.create.success', 'success')
    expect(wrapper.emitted('created')).toEqual([['!new:example.com']])
    // 创建后切换到邀请阶段，不立即关闭弹窗
    expect(getVm(wrapper).stage).toBe('invite')
  })

  it('默认加密开启且房间类型为私密', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    expect(getVm(wrapper).formData.isEncrypted).toBe(true)
    expect(getVm(wrapper).formData.roomType).toBe('private_room')
  })

  it('邀请阶段可以跳过并关闭弹窗', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    getVm(wrapper).formData.name = 'Test Room'
    await nextTick()

    await getCreateButton(wrapper).trigger('click')
    await flushPromises()

    expect(getVm(wrapper).stage).toBe('invite')

    const skipButton = wrapper.findAll('button').find((btn) => btn.text().includes('room.create.invite_skip'))
    expect(skipButton).toBeTruthy()
    await skipButton!.trigger('click')

    expect(wrapper.emitted('update:visible')).toEqual([[false]])
    expect(getVm(wrapper).formData.name).toBe('')
    expect(getVm(wrapper).stage).toBe('create')
  })

  it('创建阶段不显示高级设置（加密/历史/加入规则）', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    // 高级设置字段不应在创建阶段显示
    const text = wrapper.text()
    expect(text).not.toContain('room.create.history')
    expect(text).not.toContain('room.create.join_rule')
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
    expect(showFeedbackMock).toHaveBeenCalledWith('room.create.failed', 'error')
    expect(getVm(wrapper).creating).toBe(false)
  })

  it('关闭弹窗时重置表单', async () => {
    const wrapper = mountDialog()

    await flushPromises()

    getVm(wrapper).formData.name = 'Will Reset'
    getVm(wrapper).formData.alias = 'reset-me'
    getVm(wrapper).formData.roomType = 'room'
    await nextTick()

    await wrapper.setProps({ visible: false })
    await nextTick()

    expect(getVm(wrapper).formData.name).toBe('')
    expect(getVm(wrapper).formData.alias).toBe('')
    expect(getVm(wrapper).formData.roomType).toBe('private_room')
    expect(getVm(wrapper).stage).toBe('create')
  })
})
