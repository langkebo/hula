import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EditBirthday from '../EditBirthday.vue'

const {
  backMock,
  showFeedbackMock,
  getExtendedProfileMock,
  updateOwnExtendedProfileMock,
  MockExtendedProfileUnsupportedError
} = vi.hoisted(() => {
  class MockExtendedProfileUnsupportedError extends Error {}

  return {
    backMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    getExtendedProfileMock: vi.fn(),
    updateOwnExtendedProfileMock: vi.fn(),
    MockExtendedProfileUnsupportedError
  }
})

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
          'mobile_edit_brithday.title': '编辑生日',
          'mobile_edit_brithday.select_date': '选择日期',
          'mobile_edit_brithday.options.display_birthday_tag': '显示生日标签',
          'mobile_edit_brithday.options.displsy_age': '显示年龄',
          'mobile_edit_brithday.options.display_constellation': '显示星座',
          'mobile_edit_brithday.save_btn': '保存',
          'mobile_edit_brithday.save_success': '生日资料已更新',
          'mobile_edit_brithday.save_failed': '生日资料保存失败',
          'mobile_edit_brithday.unsupported': '当前服务器暂不支持保存生日资料'
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
    getExtendedProfile: (...args: unknown[]) => getExtendedProfileMock(...args),
    updateOwnExtendedProfile: (...args: unknown[]) => updateOwnExtendedProfileMock(...args)
  }
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: '@birthday:server.test'
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn()
  })
}))

describe('EditBirthday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getExtendedProfileMock.mockResolvedValue({
      birthday: '2001-02-03',
      displayBirthdayTag: true,
      displayAge: false,
      displayConstellation: true
    })
    updateOwnExtendedProfileMock.mockResolvedValue(undefined)
  })

  it('挂载时会回填已保存的生日资料', async () => {
    const wrapper = mount(EditBirthday, {
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
          VanDatePicker: {
            props: ['modelValue', 'title'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanSwitch: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await flushPromises()

    expect(getExtendedProfileMock).toHaveBeenCalledWith('@birthday:server.test')
    expect((wrapper.vm as any).selectedDate).toEqual(['2001', '02', '03'])
    expect((wrapper.vm as any).showBirthdayTag).toBe(true)
    expect((wrapper.vm as any).showAge).toBe(false)
    expect((wrapper.vm as any).showConstellation).toBe(true)
  })

  it('保存时会调用 MSC4133 扩展资料接口', async () => {
    const wrapper = mount(EditBirthday, {
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
          VanDatePicker: {
            props: ['modelValue', 'title'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanSwitch: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await flushPromises()

    ;(wrapper.vm as any).selectedDate = ['1999', '12', '31']
    ;(wrapper.vm as any).showBirthdayTag = false
    ;(wrapper.vm as any).showAge = true
    ;(wrapper.vm as any).showConstellation = false

    await (wrapper.vm as any).handleSave()

    expect(updateOwnExtendedProfileMock).toHaveBeenCalledWith({
      birthday: '1999-12-31',
      displayBirthdayTag: false,
      displayAge: true,
      displayConstellation: false
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('生日资料已更新', 'success')
    expect(backMock).toHaveBeenCalled()
  })

  it('服务器不支持 MSC4133 时显示降级提示且不返回上一页', async () => {
    updateOwnExtendedProfileMock.mockRejectedValue(new MockExtendedProfileUnsupportedError())

    const wrapper = mount(EditBirthday, {
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
          VanDatePicker: {
            props: ['modelValue', 'title'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanSwitch: {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template: '<div />'
          },
          VanButton: {
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
          }
        }
      }
    })

    await flushPromises()
    await (wrapper.vm as any).handleSave()

    expect(showFeedbackMock).toHaveBeenCalledWith('当前服务器暂不支持保存生日资料', 'warning')
    expect(backMock).not.toHaveBeenCalled()
  })
})
