import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flushSettingsWrites,
  hasPendingSettingsWrites,
  resetSettingsPendingWritesForTest
} from '@/composables/settings/settingsPendingWrites'
import { createI18nMock } from '~/tests/i18n-messages'

vi.mock('vue-i18n', () => createI18nMock())

// 该 composable 在模块内调用 onMounted(loadExtendedProfile)：单测没有组件实例，
// 保留真实 onMounted 会打一堆 warning 且触发一次无关的 profile 读取。
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>()
  return { ...actual, onMounted: () => undefined }
})

const { updateDisplayNameMock, updateOwnExtendedProfileMock, getExtendedProfileMock, showFeedbackMock } = vi.hoisted(
  () => ({
    updateDisplayNameMock: vi.fn(),
    updateOwnExtendedProfileMock: vi.fn(),
    getExtendedProfileMock: vi.fn(),
    showFeedbackMock: vi.fn()
  })
)

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: { updateDisplayName: updateDisplayNameMock }
}))

vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  profileService: {
    updateOwnExtendedProfile: updateOwnExtendedProfileMock,
    getExtendedProfile: getExtendedProfileMock
  }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', async () => {
  const { ref } = await import('vue')
  const status = ref<'supported' | 'unsupported' | 'unknown'>('supported')
  return {
    __capabilityStatus: status,
    useServerCapability: () => ({
      isCapabilityAvailable: (name: string) => name === 'extended-profile' && status.value === 'supported',
      getCapabilityStatus: () => status.value
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

const userStoreMock = {
  currentUserDisplayName: 'Alice',
  userInfo: { uid: '@alice:hs', resume: '', sex: 0 },
  matrixProfile: { resume: undefined as string | undefined, sex: undefined as number | undefined }
}

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ userId: '@alice:hs' })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { useAccountProfileForm } from '../useAccountProfileForm'

const { __capabilityStatus: capabilityStatus } = (await import(
  '@/services/matrix/MatrixCapabilityService'
)) as unknown as { __capabilityStatus: import('vue').Ref<'supported' | 'unsupported' | 'unknown'> }

/** 手动可控的 promise 替身。 */
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

/**
 * 这一组的核心不是"表单能保存"，而是"写请求被登记进 pending 注册表"。
 *
 * 少了登记，`hasDirty()`（自动保存表单恒为 false）+ `hasPending()`（恒 false）
 * 会让关窗守卫直接放行，用户改完昵称按 Cmd+W 时 blur 还没触发就丢输入。
 * 因此这里断言的是"调用后立刻 hasPendingSettingsWrites() === true"——
 * 一旦 `trackSettingsWrite` 被删掉，本组会直接失败。
 */
describe('useAccountProfileForm 登记在飞写请求', () => {
  beforeEach(() => {
    resetSettingsPendingWritesForTest()
    vi.clearAllMocks()
    getExtendedProfileMock.mockResolvedValue({})
    userStoreMock.currentUserDisplayName = 'Alice'
    capabilityStatus.value = 'supported'
  })

  it('昵称保存：请求在飞时 hasPending 为 true，settle 后自动清除', async () => {
    const pending = deferred()
    updateDisplayNameMock.mockReturnValueOnce(pending.promise)

    const form = useAccountProfileForm()
    form.formData.displayName = 'Alice2'

    const saving = form.handleDisplayNameChange()

    // 关键断言：请求已登记（删掉 trackSettingsWrite 这句就挂）
    expect(hasPendingSettingsWrites()).toBe(true)

    pending.resolve()
    await saving
    await flushMicrotasks()

    expect(hasPendingSettingsWrites()).toBe(false)
    expect(updateDisplayNameMock).toHaveBeenCalledWith('Alice2')
  })

  it('扩展资料保存：请求在飞时 hasPending 为 true', async () => {
    const pending = deferred()
    updateOwnExtendedProfileMock.mockReturnValueOnce(pending.promise)

    const form = useAccountProfileForm()
    form.formData.about = 'hello'

    const saving = form.handleAboutChange()

    expect(hasPendingSettingsWrites()).toBe(true)

    pending.resolve()
    await saving
    await flushMicrotasks()

    expect(hasPendingSettingsWrites()).toBe(false)
    expect(updateOwnExtendedProfileMock).toHaveBeenCalledWith({ resume: 'hello' })
  })

  it('保存失败时 pending 也会清除，且不抛异常（沿用原有回滚语义）', async () => {
    const pending = deferred()
    updateDisplayNameMock.mockReturnValueOnce(pending.promise)

    const form = useAccountProfileForm()
    form.formData.displayName = 'Alice3'

    const saving = form.handleDisplayNameChange()
    expect(hasPendingSettingsWrites()).toBe(true)

    pending.reject(new Error('network'))
    await saving
    await flushMicrotasks()

    expect(hasPendingSettingsWrites()).toBe(false)
    expect(form.formData.displayName).toBe('Alice')
    expect(showFeedbackMock).toHaveBeenCalled()
  })

  it('flushSettingsWrites 能等到表单写请求完成（关窗路径的契约）', async () => {
    const pending = deferred()
    updateDisplayNameMock.mockReturnValueOnce(pending.promise)

    const form = useAccountProfileForm()
    form.formData.displayName = 'Alice4'
    void form.handleDisplayNameChange()

    let flushed = false
    const flushing = flushSettingsWrites().then(() => {
      flushed = true
    })

    await flushMicrotasks()
    expect(flushed).toBe(false)

    pending.resolve()
    await flushing
    expect(flushed).toBe(true)
    expect(hasPendingSettingsWrites()).toBe(false)
  })
})

describe('useAccountProfileForm 扩展资料能力状态', () => {
  beforeEach(() => {
    resetSettingsPendingWritesForTest()
    vi.clearAllMocks()
    getExtendedProfileMock.mockResolvedValue({})
    capabilityStatus.value = 'supported'
  })

  it('能力 unknown 时不禁用字段，能力就绪后自动补读取', async () => {
    capabilityStatus.value = 'unknown'

    const form = useAccountProfileForm()

    expect(form.supportsExtendedProfile.value).toBe(false)
    expect(form.extendedProfileUnsupported.value).toBe(false)
    expect(form.extendedProfileDisabled.value).toBe(false)
    expect(getExtendedProfileMock).not.toHaveBeenCalled()

    capabilityStatus.value = 'supported'
    await flushMicrotasks()

    expect(getExtendedProfileMock).toHaveBeenCalledWith('@alice:hs')
  })

  it('能力明确 unsupported 时才禁用字段', () => {
    capabilityStatus.value = 'unsupported'

    const form = useAccountProfileForm()

    expect(form.extendedProfileUnsupported.value).toBe(true)
    expect(form.extendedProfileDisabled.value).toBe(true)
  })
})
