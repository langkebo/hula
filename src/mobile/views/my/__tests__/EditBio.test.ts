import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditBio from '../EditBio.vue'

const { backMock, showFeedbackMock, updateOwnExtendedProfileMock, MockExtendedProfileUnsupportedError } = vi.hoisted(
  () => {
    class MockExtendedProfileUnsupportedError extends Error {}

    return {
      backMock: vi.fn(),
      showFeedbackMock: vi.fn(),
      updateOwnExtendedProfileMock: vi.fn(),
      MockExtendedProfileUnsupportedError
    }
  }
)

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      back: backMock
    })
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          'mobile_edit_bio.title': '编辑签名',
          'mobile_edit_bio.placeholder': '介绍一下你自己~',
          'mobile_edit_bio.save_btn': '保存',
          'mobile_edit_bio.save_success': '个人简介已更新',
          'mobile_edit_bio.save_failed': '个人简介保存失败',
          'mobile_edit_bio.unsupported': '当前服务器暂不支持保存个人简介'
        }) as Record<string, string>
      )[key] ?? key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  ExtendedProfileUnsupportedError: MockExtendedProfileUnsupportedError,
  profileService: {
    updateOwnExtendedProfile: (...args: unknown[]) => updateOwnExtendedProfileMock(...args)
  }
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      resume: '旧简介'
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn()
  })
}))

describe('EditBio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('保存简介时会调用 MSC4133 扩展资料接口', async () => {
    updateOwnExtendedProfileMock.mockResolvedValue(undefined)

    const wrapper = mount(EditBio, {
      global: {
        stubs: {
          AutoFixHeightPage: {
            template: '<div><slot name="header" /><slot name="container" /></div>',
            props: ['showFooter']
          },
          HeaderBar: {
            template: '<div />',
            props: ['isOfficial', 'border', 'hiddenRight', 'roomName']
          },
          VanForm: {
            template: '<form><slot /></form>'
          },
          VanField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          VanButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await wrapper.find('textarea').setValue('新的简介')
    await wrapper.find('button').trigger('click')

    expect(updateOwnExtendedProfileMock).toHaveBeenCalledWith({ resume: '新的简介' })
    expect(showFeedbackMock).toHaveBeenCalledWith('个人简介已更新', 'success')
    expect(backMock).toHaveBeenCalled()
  })

  it('服务器不支持 MSC4133 时显示降级提示且不返回上一页', async () => {
    updateOwnExtendedProfileMock.mockRejectedValue(new MockExtendedProfileUnsupportedError())

    const wrapper = mount(EditBio, {
      global: {
        stubs: {
          AutoFixHeightPage: {
            template: '<div><slot name="header" /><slot name="container" /></div>',
            props: ['showFooter']
          },
          HeaderBar: {
            template: '<div />',
            props: ['isOfficial', 'border', 'hiddenRight', 'roomName']
          },
          VanForm: {
            template: '<form><slot /></form>'
          },
          VanField: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
          },
          VanButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await wrapper.find('textarea').setValue('不支持的简介')
    await wrapper.find('button').trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('当前服务器暂不支持保存个人简介', 'warning')
    expect(backMock).not.toHaveBeenCalled()
  })
})
