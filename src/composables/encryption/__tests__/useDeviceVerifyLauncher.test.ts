import { beforeEach, describe, expect, it } from 'vitest'
import {
  closeDeviceVerification,
  openDeviceVerification,
  resetDeviceVerificationLauncher,
  useDeviceVerifyLauncher
} from '../useDeviceVerifyLauncher'

/**
 * 设备验证对话框启动器（单例）
 *
 * 覆盖：单例状态共享、open/close 语义、close 必须清空 target
 * 不覆盖：对话框组件本身的渲染（见 DeviceVerifyDialog.*.test.ts）
 */
describe('useDeviceVerifyLauncher', () => {
  beforeEach(() => {
    resetDeviceVerificationLauncher()
  })

  it('open 会置位 visible 并记录目标用户', () => {
    openDeviceVerification({ userId: '@bob:example.com' })

    const launcher = useDeviceVerifyLauncher()
    expect(launcher.visible.value).toBe(true)
    expect(launcher.target.value.userId).toBe('@bob:example.com')
  })

  it('不同调用点拿到同一份单例状态（跨组件共享的前提）', () => {
    const a = useDeviceVerifyLauncher()
    const b = useDeviceVerifyLauncher()

    a.open({ userId: '@bob:example.com' })

    expect(b.visible.value).toBe(true)
    expect(b.target.value.userId).toBe('@bob:example.com')
  })

  it('open 不传参时表示「验证本账号其它设备」：visible 置位且 target 为空', () => {
    openDeviceVerification()

    const launcher = useDeviceVerifyLauncher()
    expect(launcher.visible.value).toBe(true)
    expect(launcher.target.value).toEqual({})
  })

  it('close 必须同时清空 target —— 否则下次打开会残留上一条消息的 userId', () => {
    openDeviceVerification({ userId: '@bob:example.com', deviceId: 'BOB_PHONE' })
    closeDeviceVerification()

    const launcher = useDeviceVerifyLauncher()
    expect(launcher.visible.value).toBe(false)
    expect(launcher.target.value).toEqual({})
  })

  it('open 会整体替换上一次的目标，不与旧目标合并', () => {
    openDeviceVerification({ userId: '@bob:example.com', deviceId: 'BOB_PHONE', deviceName: 'Bob Phone' })
    openDeviceVerification({ userId: '@carol:example.com' })

    const launcher = useDeviceVerifyLauncher()
    expect(launcher.target.value).toEqual({ userId: '@carol:example.com' })
  })
})
