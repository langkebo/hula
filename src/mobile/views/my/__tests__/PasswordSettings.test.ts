import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PasswordSettings from '../PasswordSettings.vue'

/** 组件源码：用于校验模板层的可访问性契约（与仓库既有 source-level 断言一致） */
const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../PasswordSettings.vue'), 'utf8')

/**
 * 移动端密码修改页（方案 3.2）。
 *
 * 覆盖：分步字段、实时强度指示器（4 段 + role=status）、
 * 「退出其他设备」选项、UIA 成功/失败反馈、可访问性属性。
 */

const changePasswordMock = vi.fn()
const showToastMock = vi.fn()
const showLoadingToastMock = vi.fn((..._args: any[]) => ({ close: vi.fn() }))
const routerReplaceMock = vi.fn()

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      inheritAttrs: false,
      template: `<${tag} v-bind="$attrs"><slot /><slot name="button" /></${tag}>`
    })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showLoadingToast: (...args: any[]) => showLoadingToastMock(...args),
    VanField: defineComponent({
      name: 'VanField',
      props: ['modelValue', 'type', 'label', 'placeholder', 'autocomplete', 'ariaLabel'],
      emits: ['update:modelValue'],
      template:
        '<input :type="type" :data-label="label" :autocomplete="autocomplete" :aria-label="ariaLabel" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    }),
    VanButton: passthrough('VanButton', 'button'),
    VanCheckbox: defineComponent({
      name: 'VanCheckbox',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>'
    }),
    VanCellGroup: passthrough('VanCellGroup'),
    VanNavBar: passthrough('VanNavBar'),
    VanForm: passthrough('VanForm')
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock, back: vi.fn(), push: vi.fn() })
}))

// 组件树会间接加载应用路由实例，必须隔离，否则真实 router 的 beforeEach 会在模块作用域执行
vi.mock('@/router', () => ({
  default: { push: vi.fn(), replace: vi.fn(), back: vi.fn() }
}))

vi.mock('@/composables/user/useAccount', () => ({
  useAccount: () => ({ changePassword: changePasswordMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

interface PasswordSettingsVm {
  oldPassword: string
  newPassword: string
  confirmPassword: string
  logoutOthers: boolean
  strengthLevel: number
  canSubmit: boolean
  handleSubmit: () => Promise<void>
}

const mountPage = () => mount(PasswordSettings)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as PasswordSettingsVm

describe('PasswordSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePasswordMock.mockResolvedValue(true)
  })

  it('模板声明三个密码字段', () => {
    const passwordFields = SOURCE.match(/type="password"/g) ?? []
    expect(passwordFields.length).toBe(3)
  })

  it('密码字段带 autocomplete 语义（current / new）', () => {
    expect(SOURCE).toContain('autocomplete="current-password"')
    expect(SOURCE.match(/autocomplete="new-password"/g) ?? []).toHaveLength(2)
  })

  it('每个密码字段都带 aria-label（纯图标/无标签输入的可访问性要求）', () => {
    const ariaLabels = SOURCE.match(/:aria-label="t\('mobile_password\.[a-z_]+'\)"/g) ?? []
    expect(ariaLabels.length).toBeGreaterThanOrEqual(3)
  })

  it('强度指示器暴露 role=status 且 aria-live=polite', () => {
    const wrapper = mountPage()
    const indicator = wrapper.find('[role="status"]')
    expect(indicator.exists()).toBe(true)
    expect(indicator.attributes('aria-live')).toBe('polite')
  })

  it('强度等级随输入实时变化', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    expect(vm.strengthLevel).toBe(0)
    vm.newPassword = 'Str0ng!Pass'
    await flushPromises()
    expect(vm.strengthLevel).toBe(4)
  })

  it('两次新密码不一致时拒绝提交并提示', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = 'OldPass1!'
    vm.newPassword = 'Str0ng!Pass'
    vm.confirmPassword = 'Different1!'

    await vm.handleSubmit()

    expect(changePasswordMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalled()
  })

  it('旧密码缺失时拒绝提交', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = ''
    vm.newPassword = 'Str0ng!Pass'
    vm.confirmPassword = 'Str0ng!Pass'

    await vm.handleSubmit()

    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('弱密码（不满足后端策略）拒绝提交', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = 'OldPass1!'
    vm.newPassword = 'weakpass'
    vm.confirmPassword = 'weakpass'

    await vm.handleSubmit()

    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('合法输入提交时传递 logoutOthers 选项', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = 'OldPass1!'
    vm.newPassword = 'Str0ng!Pass'
    vm.confirmPassword = 'Str0ng!Pass'
    vm.logoutOthers = true

    await vm.handleSubmit()

    expect(changePasswordMock).toHaveBeenCalledWith('OldPass1!', 'Str0ng!Pass', true)
  })

  it('修改成功后清空表单并返回上一页', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = 'OldPass1!'
    vm.newPassword = 'Str0ng!Pass'
    vm.confirmPassword = 'Str0ng!Pass'

    await vm.handleSubmit()

    expect(vm.oldPassword).toBe('')
    expect(vm.newPassword).toBe('')
    expect(routerReplaceMock).toHaveBeenCalled()
  })

  it('修改失败时保留输入并提示错误（不跳转）', async () => {
    changePasswordMock.mockRejectedValueOnce(new Error('M_FORBIDDEN'))
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    vm.oldPassword = 'WrongOld1!'
    vm.newPassword = 'Str0ng!Pass'
    vm.confirmPassword = 'Str0ng!Pass'

    await vm.handleSubmit()

    expect(vm.oldPassword).toBe('WrongOld1!')
    expect(routerReplaceMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalled()
  })
})
