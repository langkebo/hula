import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileCrossSigningSetup from '../MobileCrossSigningSetup.vue'

const setupCrossSigningMock = vi.hoisted(() => vi.fn())
const getCrossSigningStatusMock = vi.hoisted(() => vi.fn())
const storeCrossSigningKeysMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    setupCrossSigning: setupCrossSigningMock,
    getCrossSigningStatus: getCrossSigningStatusMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vant', () => ({ showToast: vi.fn() }))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => ({
    storeCrossSigningKeysInSecretStorage: storeCrossSigningKeysMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

const dialogStub = {
  props: ['show'],
  template: '<div v-if="show" data-test="dialog"><slot /></div>'
}

const buttonStub = {
  props: ['loading', 'disabled', 'type', 'block'],
  emits: ['click'],
  template: '<button type="button" data-test="button" @click="$emit(\'click\')"><slot /></button>'
}

const fieldStub = {
  props: ['modelValue', 'label', 'placeholder', 'type'],
  emits: ['update:modelValue'],
  template:
    '<input data-test="password" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}

function createWrapper() {
  return mount(MobileCrossSigningSetup, {
    props: { modelValue: true },
    global: {
      stubs: {
        'van-dialog': dialogStub,
        'van-button': buttonStub,
        'van-field': fieldStub,
        'van-icon': { template: '<i />' },
        'van-notice-bar': { props: ['text'], template: '<div data-test="notice">{{ text }}</div>' }
      }
    }
  })
}

/** 点击第 n 个按钮（0-based），返回 wrapper 便于继续断言 */
async function clickButton(wrapper: ReturnType<typeof createWrapper>, index = 0) {
  const buttons = wrapper.findAll('[data-test="button"]')
  await buttons[index]!.trigger('click')
}

describe('MobileCrossSigningSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupCrossSigningMock.mockResolvedValue(undefined)
    getCrossSigningStatusMock.mockResolvedValue({
      privateKeysInSecretStorage: true,
      publicKeysOnDevice: true
    })
    storeCrossSigningKeysMock.mockResolvedValue('stored')
  })

  /**
   * 安全守卫：没有密码就绝不发起 UIA 请求。
   * 空密码提交会让 SDK 侧产生一个必然失败的请求，也会把「用户没输入」伪装成「服务端拒绝」。
   */
  it('未输入密码时不调用 setupCrossSigning', async () => {
    const wrapper = createWrapper()

    await clickButton(wrapper)

    expect(setupCrossSigningMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('completed')).toBeUndefined()
    expect(wrapper.find('[data-test="cross-signing-error"]').exists()).toBe(true)
  })

  it('输入密码后建立交叉签名并发 completed', async () => {
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)

    expect(setupCrossSigningMock).toHaveBeenCalledWith({ password: 'correct-password' })
    expect(wrapper.emitted('completed')).toHaveLength(1)
    expect(wrapper.find('[data-test="cross-signing-success"]').exists()).toBe(true)
  })

  /**
   * 密码只在 intro 阶段存在；成功后视图切到 success，输入框必须消失。
   * （内部状态由 `password.value = ''` 清空，这里断言的是用户可见的结果：
   *  成功页面上不能还留着一个填着密码的输入框。）
   */
  it('成功后不再渲染密码输入框', async () => {
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)

    expect(wrapper.find('[data-test="cross-signing-success"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="password"]').exists()).toBe(false)
  })

  /**
   * 假成功守卫：失败时绝不能 emit completed —— 父组件据此刷新设备列表，
   * 误报会让「所有设备已验证」的结论建立在没有交叉签名的基础上。
   */
  it('UIA 失败时显示密码错误且不发 completed', async () => {
    setupCrossSigningMock.mockRejectedValue(new Error('M_FORBIDDEN: Invalid password'))
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('wrong-password')
    await clickButton(wrapper)

    expect(wrapper.emitted('completed')).toBeUndefined()
    const errorBlock = wrapper.find('[data-test="cross-signing-error"]')
    expect(errorBlock.exists()).toBe(true)
    expect(errorBlock.text()).toContain('mobile_cross_signing.wrong_password')
  })

  it('私钥未入 4S 时提示继续设置安全密钥', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      privateKeysInSecretStorage: false,
      publicKeysOnDevice: true
    })
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)

    expect(wrapper.text()).toContain('mobile_cross_signing.needs_security_key')
    expect(wrapper.text()).toContain('mobile_cross_signing.finish_recovery')
  })

  /**
   * 4S 已存在时必须**直接存**，而不是跳去安全密钥页 ——
   * 跳过去只是重复 bootstrap，私钥仍然进不了 4S，按钮等于没解决问题。
   */
  it('4S 已存在时点「完成恢复设置」直接存入，提示消失', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      privateKeysInSecretStorage: false,
      publicKeysOnDevice: true
    })
    storeCrossSigningKeysMock.mockResolvedValue('stored')
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)
    expect(wrapper.text()).toContain('mobile_cross_signing.needs_security_key')

    await clickButton(wrapper, 0)

    expect(storeCrossSigningKeysMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('mobile_cross_signing.needs_security_key')
  })

  it('4S 尚未配置时引导去设置安全密钥', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      privateKeysInSecretStorage: false,
      publicKeysOnDevice: true
    })
    storeCrossSigningKeysMock.mockResolvedValue('needs-setup')
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)
    await clickButton(wrapper, 0)

    expect(wrapper.emitted('needs-security-key')).toHaveLength(1)
  })

  it('存私钥失败时报错，不假装已存入', async () => {
    getCrossSigningStatusMock.mockResolvedValue({
      privateKeysInSecretStorage: false,
      publicKeysOnDevice: true
    })
    storeCrossSigningKeysMock.mockResolvedValue('failed')
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)
    await clickButton(wrapper, 0)

    expect(wrapper.find('[data-test="cross-signing-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('mobile_cross_signing.store_keys_failed')
  })

  it('私钥已入 4S 时不再啰嗦安全密钥', async () => {
    const wrapper = createWrapper()

    await wrapper.find('[data-test="password"]').setValue('correct-password')
    await clickButton(wrapper)

    expect(wrapper.text()).not.toContain('mobile_cross_signing.needs_security_key')
  })
})
