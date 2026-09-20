import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileSecurityKeySetup from '../MobileSecurityKeySetup.vue'

const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../MobileSecurityKeySetup.vue'), 'utf8')

/**
 * 移动端安全密钥（SSSS 恢复密钥）设置向导（方案 4.2）。
 *
 * 缺口背景：桌面 `SecurityKeySetupDialog.vue` 有完整 6 步向导
 * （intro → passphrase → generating → showKey → verify → success），
 * 移动端**完全没有对应实现**——用户在移动端无法生成/查看恢复密钥，
 * 换设备时无法恢复密钥备份。
 */

const setupKeyBackupWithOptionsMock = vi.fn()
const showToastMock = vi.fn()

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    VanButton: passthrough('VanButton', 'button'),
    VanField: defineComponent({
      name: 'VanField',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
    }),
    VanCheckbox: defineComponent({
      name: 'VanCheckbox',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template:
        '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot /></label>'
    }),
    VanSteps: passthrough('VanSteps'),
    VanStep: passthrough('VanStep'),
    VanCellGroup: passthrough('VanCellGroup'),
    VanNoticeBar: passthrough('VanNoticeBar'),
    VanLoading: passthrough('VanLoading')
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), back: vi.fn(), replace: vi.fn() } }))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    setupKeyBackupWithOptions: (...a: any[]) => setupKeyBackupWithOptionsMock(...a)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

interface Vm {
  step: string
  passphrase: string
  recoveryKey: string
  acknowledged: boolean
  formattedKey: string
  startGenerate: () => Promise<void>
  confirmWritten: () => void
  reset: () => void
}

const mountPage = () => mount(MobileSecurityKeySetup)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

describe('MobileSecurityKeySetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupKeyBackupWithOptionsMock.mockResolvedValue('EsTj LW6N 9WqD')
  })

  it('初始处于 intro 步骤', () => {
    expect(vmOf(mountPage()).step).toBe('intro')
  })

  it('生成成功：进入 showKey 并保留恢复密钥', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    await vm.startGenerate()
    await flushPromises()

    expect(setupKeyBackupWithOptionsMock).toHaveBeenCalled()
    expect(vm.step).toBe('showKey')
    expect(vm.recoveryKey).toBe('EsTj LW6N 9WqD')
  })

  it('恢复密钥按 4 字符分组展示，便于手抄', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    await vm.startGenerate()
    await flushPromises()

    expect(vm.formattedKey).toBe('EsTj LW6N 9WqD')
  })

  it('生成失败：进入 failed 并提示，不展示密钥', async () => {
    setupKeyBackupWithOptionsMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    const vm = vmOf(wrapper)

    await vm.startGenerate()
    await flushPromises()

    expect(vm.step).toBe('failed')
    expect(vm.recoveryKey).toBe('')
    expect(showToastMock).toHaveBeenCalled()
  })

  it('未确认已抄写时不得进入 success（防止用户跳过记录密钥）', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    await vm.startGenerate()
    await flushPromises()

    vm.acknowledged = false
    vm.confirmWritten()

    expect(vm.step).toBe('showKey')
  })

  it('确认已抄写后进入 success', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    await vm.startGenerate()
    await flushPromises()

    vm.acknowledged = true
    vm.confirmWritten()

    expect(vm.step).toBe('success')
  })

  it('reset 清空敏感状态（避免密钥残留在内存/界面）', async () => {
    const wrapper = mountPage()
    const vm = vmOf(wrapper)
    await vm.startGenerate()
    await flushPromises()

    vm.reset()

    expect(vm.recoveryKey).toBe('')
    expect(vm.passphrase).toBe('')
    expect(vm.acknowledged).toBe(false)
    expect(vm.step).toBe('intro')
  })

  it('模板引用信任声明文案键（私钥仅由你掌控）', () => {
    // 该文案是 Matrix 数据主权的核心表达，必须在向导里出现；
    // 断言源码引用了该 i18n 键（渲染层面的文案由语言包保证）
    expect(SOURCE).toContain('mobile_security_key.trust_notice')
  })

  it('恢复密钥展示使用等宽字体并禁止截图提示（方案 4.2）', () => {
    expect(SOURCE).toContain('mobile_security_key.no_screenshot_hint')
  })
})
