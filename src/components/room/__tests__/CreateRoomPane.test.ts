import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import CreateRoomPane from '../CreateRoomPane.vue'

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

const dialogWarningMock = vi.fn()
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    useDialog: () => ({
      warning: dialogWarningMock,
      info: vi.fn(),
      error: vi.fn()
    })
  }
})

const uploadAvatarCropMock = vi.fn()
const openAvatarCropperMock = vi.fn()
const handleFileChangeMock = vi.fn()
vi.mock('@/composables/user/useAvatarUpload', () => ({
  useAvatarUpload: vi.fn(() => ({
    fileInput: ref(null),
    localImageUrl: ref(''),
    showCropper: ref(false),
    cropperRef: ref(null),
    openAvatarCropper: openAvatarCropperMock,
    handleFileChange: handleFileChangeMock,
    handleCrop: uploadAvatarCropMock
  }))
}))

// Mock components
const NButtonStub = defineComponent({
  name: 'NButton',
  template: '<button class="n-button-stub"><slot /></button>'
})

const NFormStub = defineComponent({
  name: 'NForm',
  setup(_, { expose, slots }) {
    const validate = vi.fn().mockResolvedValue(true)
    expose({ validate })
    return () => h('div', slots.default?.())
  }
})

vi.mock('@/components/common/AvatarCropper.vue', () => ({
  default: {
    name: 'AvatarCropper',
    template: '<div class="avatar-cropper-mock"></div>'
  }
}))

describe('CreateRoomPane.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the creation form correctly', () => {
    const wrapper = mount(CreateRoomPane, {
      props: {
        submitting: false
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          NButton: NButtonStub,
          NForm: NFormStub,
          NFormItem: true,
          NInput: true,
          NRadioGroup: true,
          NRadio: true,
          NSelect: true,
          NSwitch: true
        }
      }
    })

    expect(wrapper.find('.pane-title').text()).toBe('room.create.title')
    expect(wrapper.find('.avatar-label').text()).toBe('room.create.avatar')
  })

  it('avatar preview is clickable without triggering upload (not yet integrated)', async () => {
    const wrapper = mount(CreateRoomPane, {
      props: {
        submitting: false
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          NButton: NButtonStub,
          NForm: NFormStub,
          NFormItem: true,
          NInput: true,
          NRadioGroup: true,
          NRadio: true,
          NSelect: true,
          NSwitch: true
        }
      }
    })

    await wrapper.find('.avatar-preview').trigger('click')
    // Avatar upload is not yet integrated (TODO), so openAvatarCropper is not called
    expect(openAvatarCropperMock).not.toHaveBeenCalled()
  })

  it('emits close event when clicking cancel or close button', async () => {
    const wrapper = mount(CreateRoomPane, {
      props: {
        submitting: false
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          NButton: {
            emits: ['click'],
            template: '<button class="test-button" @click="$emit(\'click\')"><slot /></button>'
          },
          NForm: NFormStub,
          NFormItem: true,
          NInput: true,
          NRadioGroup: true,
          NRadio: true,
          NSelect: true,
          NSwitch: true
        }
      }
    })

    const buttons = wrapper.findAll('button')
    // Close button in header
    await buttons[0].trigger('click')
    // Cancel button in footer
    await buttons[1].trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
