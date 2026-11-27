import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import MobileThreePid from '../MobileThreePid.vue'

/**
 * 移动端「邮箱 / 手机号」（3PID）绑定页。
 *
 * 背景：桌面 `ThreePidSection` 有完整的绑定/解绑闭环，移动端此前 3PID 覆盖为 0，
 * 用户在手机上无法绑定邮箱、也就无法用于账号找回。本页补齐这一目标页。
 *
 * 绑定是三步链路，这里重点盯住**调用顺序与参数传递**：
 * requestThreePidEmailToken → (用户填码) submitThreePidEmailToken → addThreePidWithPassword。
 * 少调 submit 就会拿未验证的 sid 去 add，服务端必失败。
 */

const getThreePidsMock = vi.fn()
const deleteThreePidMock = vi.fn()
const requestTokenMock = vi.fn()
const submitTokenMock = vi.fn()
const addWithPasswordMock = vi.fn()

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args),
    VanCellGroup: passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    VanButton: passthrough('VanButton', 'button'),
    VanField: passthrough('VanField'),
    VanTag: passthrough('VanTag'),
    VanPopup: passthrough('VanPopup'),
    VanLoading: passthrough('VanLoading')
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/router', () => ({ default: { push: vi.fn(), back: vi.fn(), replace: vi.fn() } }))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getThreePids: (...a: any[]) => getThreePidsMock(...a),
    deleteThreePid: (...a: any[]) => deleteThreePidMock(...a),
    requestThreePidEmailToken: (...a: any[]) => requestTokenMock(...a),
    submitThreePidEmailToken: (...a: any[]) => submitTokenMock(...a),
    addThreePidWithPassword: (...a: any[]) => addWithPasswordMock(...a)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

vi.mock('@/mobile/components/common/MobileAsyncState.vue', () => ({
  default: { name: 'MobileAsyncState', template: '<div />', props: ['state', 'emptyText', 'minHeight'] }
}))

const EMAIL = 'user@example.com'

interface Vm {
  loading: boolean
  threepids: Array<{ medium: string; address: string; validated: boolean }>
  isEmpty: boolean
  challenge: { sid: string; clientSecret: string } | null
  formError: string
  form: { email: string; password: string; token: string }
  loadThreePids: () => Promise<void>
  confirmUnbind: (pid: { medium: string; address: string; validated: boolean }) => Promise<void>
  handleSendCode: () => Promise<void>
  handleBind: () => Promise<void>
  openForm: () => void
}

const mountPage = () => mount(MobileThreePid)
const vmOf = (w: ReturnType<typeof mount>) => w.vm as unknown as Vm

const entry = (address = EMAIL) => ({ medium: 'email', address, validated: true })

/** 直接把表单推到「已发码」状态，省去每例重复走一遍发码；邮箱刻意带空白，顺带覆盖 trim */
async function reachChallenge(vm: Vm) {
  vm.form.email = `  ${EMAIL}  `
  vm.form.password = 'secret'
  await vm.handleSendCode()
}

describe('MobileThreePid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getThreePidsMock.mockResolvedValue({ threepids: [], pending3pids: [] })
    deleteThreePidMock.mockResolvedValue(undefined)
    requestTokenMock.mockResolvedValue({ sid: 'sid-1', clientSecret: 'cs-1', submitUrl: null })
    submitTokenMock.mockResolvedValue(undefined)
    addWithPasswordMock.mockResolvedValue(undefined)
  })

  it('挂载时加载已绑定邮箱', async () => {
    getThreePidsMock.mockResolvedValue({ threepids: [entry()], pending3pids: [] })
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    expect(getThreePidsMock).toHaveBeenCalled()
    expect(vm.threepids).toHaveLength(1)
    expect(vm.isEmpty).toBe(false)
  })

  it('加载失败时提示且 loading 归位', async () => {
    getThreePidsMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()

    expect(vmOf(wrapper).loading).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_three_pid.load_failed' })
    )
  })

  it('解绑：确认后调 deleteThreePid 并从列表移除', async () => {
    getThreePidsMock.mockResolvedValue({ threepids: [entry()], pending3pids: [] })
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.confirmUnbind(entry())

    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(deleteThreePidMock).toHaveBeenCalledWith('email', EMAIL)
    expect(vm.threepids).toEqual([])
  })

  it('解绑：用户在确认框取消时不调接口', async () => {
    showConfirmDialogMock.mockRejectedValueOnce('cancel')
    getThreePidsMock.mockResolvedValue({ threepids: [entry()], pending3pids: [] })
    const wrapper = mountPage()
    await flushPromises()

    await vmOf(wrapper).confirmUnbind(entry())

    expect(deleteThreePidMock).not.toHaveBeenCalled()
  })

  it('解绑失败时保留本地项并提示', async () => {
    deleteThreePidMock.mockRejectedValueOnce(new Error('nope'))
    getThreePidsMock.mockResolvedValue({ threepids: [entry()], pending3pids: [] })
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await vm.confirmUnbind(entry())

    expect(vm.threepids).toHaveLength(1)
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_three_pid.unbind_failed' })
    )
  })

  it('发码：邮箱格式非法时拦在本地，不调接口', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.form.email = 'not-an-email'
    vm.form.password = 'secret'
    await vm.handleSendCode()

    expect(requestTokenMock).not.toHaveBeenCalled()
    expect(vm.formError).toBe('mobile_three_pid.err_invalid_email')
  })

  it('发码：缺少当前密码时拦在本地', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    vm.form.email = EMAIL
    vm.form.password = ''
    await vm.handleSendCode()

    expect(requestTokenMock).not.toHaveBeenCalled()
    expect(vm.formError).toBe('mobile_three_pid.err_password_required')
  })

  it('发码成功后进入验证码阶段，并保存 sid 与 clientSecret', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await reachChallenge(vm)

    // 邮箱两侧空白应被裁掉再发
    expect(requestTokenMock).toHaveBeenCalledWith(EMAIL)
    expect(vm.challenge).toEqual({ sid: 'sid-1', clientSecret: 'cs-1' })
  })

  it('绑定：缺少验证码时拦在本地，不提交', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await reachChallenge(vm)
    vm.form.token = '   '
    await vm.handleBind()

    expect(submitTokenMock).not.toHaveBeenCalled()
    expect(vm.formError).toBe('mobile_three_pid.err_code_required')
  })

  it('绑定：先 submitToken 再带密码 add，顺序不能颠倒', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await reachChallenge(vm)
    vm.form.token = '123456'
    await vm.handleBind()

    expect(submitTokenMock).toHaveBeenCalledWith('sid-1', 'cs-1', '123456')
    expect(addWithPasswordMock).toHaveBeenCalledWith('sid-1', 'cs-1', 'secret')

    const submitOrder = submitTokenMock.mock.invocationCallOrder[0]
    const addOrder = addWithPasswordMock.mock.invocationCallOrder[0]
    expect(submitOrder).toBeLessThan(addOrder)

    // 绑定成功后重新拉取列表，避免页面停留在旧数据
    expect(getThreePidsMock).toHaveBeenCalledTimes(2)
  })

  it('绑定失败时提示错误且不关闭表单', async () => {
    submitTokenMock.mockRejectedValueOnce(new Error('bad code'))
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await reachChallenge(vm)
    vm.form.token = '000000'
    await vm.handleBind()

    expect(addWithPasswordMock).not.toHaveBeenCalled()
    expect(vm.formError).toBe('mobile_three_pid.bind_failed')
    expect(vm.challenge).not.toBeNull()
  })

  it('打开表单时清空上一次的验证码与错误', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = vmOf(wrapper)

    await reachChallenge(vm)
    vm.formError = 'stale'
    vm.openForm()

    expect(vm.challenge).toBeNull()
    expect(vm.formError).toBe('')
    expect(vm.form.email).toBe('')
  })
})

/**
 * keep-alive 下的刷新语义。
 *
 * `MyLayout` 的 RouterView 没有 keep-alive ⇒ 进别的二级页再返回会重新挂载，onMounted 重跑；
 * 但 `MyLayout` 被外层 tab 布局缓存 ⇒ 切 Tab 回来是 activate，onMounted 不触发。
 * 后者若不补，中途在网页端解绑的邮箱会一直留在列表里。
 */
function mountInKeepAlive() {
  const Host = defineComponent({
    name: 'MobileThreePidKeepAliveHost',
    components: { MobileThreePid },
    props: { visible: { type: Boolean, default: true } },
    template: '<KeepAlive><MobileThreePid v-if="visible" /></KeepAlive>'
  })
  return mount(Host, { props: { visible: true } })
}

describe('MobileThreePid keep-alive 刷新', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getThreePidsMock.mockResolvedValue({ threepids: [], pending3pids: [] })
  })

  it('首次进入只加载一次，activated 不重复请求', async () => {
    mountInKeepAlive()
    await flushPromises()

    // mounted 与 activated 在首次挂载时都会触发，若不做判断这里会是 2
    expect(getThreePidsMock).toHaveBeenCalledTimes(1)
  })

  it('切走 Tab 再切回来（activate）时重读绑定列表', async () => {
    const wrapper = mountInKeepAlive()
    await flushPromises()
    expect(getThreePidsMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(getThreePidsMock).toHaveBeenCalledTimes(2)
  })
})
