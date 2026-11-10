import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type Ref, ref } from 'vue'

/**
 * 移动端私密聊天解锁弹窗。
 *
 * 行为契约（与桌面端 SecretChatUnlockDialog 对齐）：
 * - 成功：unlockSecretChat(密码) → 先消费 pendingPath → 再关闭 gate → router.replace(pendingPath)；
 * - 失败：累加失败计数、清空输入、保持打开，不跳转；
 * - 空密码：只提示，不发起校验。
 */

const mocks = vi.hoisted(() => ({
  // 真实模块返回 ref，测试沿用同一形状，模板才能正常解包
  visible: null as unknown as Ref<boolean>,
  failureCount: null as unknown as Ref<number>,
  pendingPath: null as unknown as Ref<unknown>,
  unlockSecretChat: vi.fn(async () => true),
  recordSecretChatUnlockFailure: vi.fn(() => 1),
  closeSecretChatUnlock: vi.fn(),
  clearSecretChatPendingPath: vi.fn(),
  consumeSecretChatPendingPath: vi.fn(),
  replace: vi.fn(async () => undefined),
  showToast: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  useSecretChatGate: () => ({
    visible: mocks.visible,
    pendingPath: mocks.pendingPath,
    failureCount: mocks.failureCount
  }),
  consumeSecretChatPendingPath: mocks.consumeSecretChatPendingPath,
  closeSecretChatUnlock: mocks.closeSecretChatUnlock,
  clearSecretChatPendingPath: mocks.clearSecretChatPendingPath,
  recordSecretChatUnlockFailure: mocks.recordSecretChatUnlockFailure
}))
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ unlockSecretChat: mocks.unlockSecretChat })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('vant', () => ({ showToast: mocks.showToast }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: mocks.loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import MobileSecretChatUnlockDialog from '../MobileSecretChatUnlockDialog.vue'

// vi.mock 工厂在导入阶段执行，此时只能拿到 mocks 容器；
// 真实 ref 在模块体里补上，组件 mount 时再读取属性即可。
const pendingTarget = { name: 'mobileChatMain', params: { roomId: '!p:test' } }
mocks.visible = ref(true)
mocks.failureCount = ref(0)
mocks.pendingPath = ref<unknown>(pendingTarget)
mocks.consumeSecretChatPendingPath.mockImplementation(() => mocks.pendingPath.value)
mocks.clearSecretChatPendingPath.mockImplementation(() => {
  mocks.pendingPath.value = null
})

/**
 * 测试环境未启用 VantResolver，`van-*` 标签会被当作原生元素；
 * 显式 stub 保证槽位内容（失败提示）可见，同时覆盖 PascalCase 名字。
 */
const global = {
  stubs: {
    VanDialog: { template: '<div><slot /></div>' },
    'van-dialog': { template: '<div><slot /></div>' },
    VanField: { template: '<input />' },
    'van-field': { template: '<input />' },
    VanButton: { template: '<button><slot /></button>' },
    'van-button': { template: '<button><slot /></button>' }
  }
}

const mountDialog = () => mount(MobileSecretChatUnlockDialog, { global })

type DialogVm = {
  password: string
  show: boolean
  handleConfirm: () => Promise<void>
  handleBeforeClose: (action: string) => Promise<boolean>
}

describe('MobileSecretChatUnlockDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.visible.value = true
    mocks.failureCount.value = 0
    mocks.pendingPath.value = pendingTarget
    mocks.unlockSecretChat.mockResolvedValue(true)
    mocks.closeSecretChatUnlock.mockImplementation(() => {
      mocks.visible.value = false
    })
    mocks.clearSecretChatPendingPath.mockImplementation(() => {
      mocks.pendingPath.value = null
    })
  })

  it('解锁成功后先消费回跳目标、再关闭 gate，并跳转到 pendingPath', async () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'DevUnlock!2026'

    await vm.handleConfirm()

    expect(mocks.unlockSecretChat).toHaveBeenCalledWith('DevUnlock!2026')
    expect(mocks.closeSecretChatUnlock).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith({ name: 'mobileChatMain', params: { roomId: '!p:test' } })
    expect(mocks.consumeSecretChatPendingPath.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.closeSecretChatUnlock.mock.invocationCallOrder[0]
    )
  })

  it('无 pendingPath 时解锁成功只关闭弹窗，不跳转到私密列表', async () => {
    // 「设为私密」等就地解锁场景不提供回跳目标：此时跳私密列表只会落到空列表，
    // 且原动作并未执行，用户还得自己回退重来。
    mocks.pendingPath.value = null
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'DevUnlock!2026'

    await vm.handleConfirm()

    expect(mocks.unlockSecretChat).toHaveBeenCalledWith('DevUnlock!2026')
    expect(mocks.closeSecretChatUnlock).toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('解锁失败记录失败次数、清空密码且不跳转、不关闭', async () => {
    mocks.unlockSecretChat.mockResolvedValueOnce(false)
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'wrong'

    await vm.handleConfirm()

    expect(mocks.recordSecretChatUnlockFailure).toHaveBeenCalledTimes(1)
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.closeSecretChatUnlock).not.toHaveBeenCalled()
    expect(vm.password).toBe('')
    expect(mocks.showToast).toHaveBeenCalled()
  })

  it('密码为空时只提示，不发起校验', async () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm

    await vm.handleConfirm()

    expect(mocks.unlockSecretChat).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalled()
  })

  it('连续失败达到阈值后显示去设置密码入口', async () => {
    mocks.failureCount.value = 2
    const wrapper = mountDialog()

    expect(wrapper.find('[data-testid="mobile-secret-chat-failure-hint"]').exists()).toBe(false)

    mocks.failureCount.value = 3
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="mobile-secret-chat-failure-hint"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('mobile_security.secret_chat.go_settings')
  })

  it('confirm 动作不自行关闭弹窗（交由 handleConfirm 决定）', async () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'DevUnlock!2026'

    const closed = await vm.handleBeforeClose('confirm')

    expect(closed).toBe(false)
    expect(mocks.unlockSecretChat).toHaveBeenCalledWith('DevUnlock!2026')
  })

  it('cancel 动作允许关闭、清空密码并丢弃 pendingPath', async () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'abc'

    const closed = await vm.handleBeforeClose('cancel')

    expect(closed).toBe(true)
    expect(vm.password).toBe('')
    expect(mocks.clearSecretChatPendingPath).toHaveBeenCalledTimes(1)
    expect(mocks.pendingPath.value).toBeNull()
    expect(mocks.unlockSecretChat).not.toHaveBeenCalled()
  })

  it('弹窗被直接关闭（show 置 false）时同样清空 pendingPath 与密码', async () => {
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'abc'

    vm.show = false
    await wrapper.vm.$nextTick()

    expect(vm.password).toBe('')
    expect(mocks.clearSecretChatPendingPath).toHaveBeenCalled()
    expect(mocks.pendingPath.value).toBeNull()
  })

  it('unlockSecretChat 抛异常时提示失败并复位 submitting，不跳转也不计失败次数', async () => {
    mocks.unlockSecretChat.mockRejectedValueOnce(new Error('pbkdf2 exploded'))
    const wrapper = mountDialog()
    const vm = wrapper.vm as unknown as DialogVm
    vm.password = 'boom'

    await vm.handleConfirm()

    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.recordSecretChatUnlockFailure).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith({ type: 'fail', message: 'login.secret_chat.verify_failed' })

    // submitting 已复位：第二次仍能进入校验
    await vm.handleConfirm()
    expect(mocks.unlockSecretChat).toHaveBeenCalledTimes(2)
  })
})
