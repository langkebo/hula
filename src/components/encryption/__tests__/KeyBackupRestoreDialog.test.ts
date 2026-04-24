import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KeyBackupRestoreDialog from '../KeyBackupRestoreDialog.vue'

const {
  restoreFromBackupMock,
  messageWarningMock,
  messageSuccessMock,
  messageErrorMock,
  setIntervalMock,
  clearIntervalMock,
  setTimeoutMock,
  intervalCallbackRef,
  timeoutCallbackRef
} = vi.hoisted(() => {
  const intervalCallbackRef = { current: null as null | (() => void) }
  const timeoutCallbackRef = { current: null as null | (() => void) }

  return {
    restoreFromBackupMock: vi.fn(),
    messageWarningMock: vi.fn(),
    messageSuccessMock: vi.fn(),
    messageErrorMock: vi.fn(),
    setIntervalMock: vi.fn((callback: () => void) => {
      intervalCallbackRef.current = callback
      return 101
    }),
    clearIntervalMock: vi.fn(),
    setTimeoutMock: vi.fn((callback: () => void) => {
      timeoutCallbackRef.current = callback
      return 202
    }),
    intervalCallbackRef,
    timeoutCallbackRef
  }
})

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:show'],
      template: '<div v-if="show" data-test="modal"><slot /><slot name="action" /></div>'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      template: '<div data-test="spin"><slot /></div>'
    }),
    NForm: defineComponent({
      name: 'NForm',
      template: '<form><slot /></form>'
    }),
    NFormItem: defineComponent({
      name: 'NFormItem',
      template: '<div data-test="form-item"><slot /></div>'
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value'],
      emits: ['update:value'],
      template: '<textarea />'
    }),
    NProgress: defineComponent({
      name: 'NProgress',
      props: ['percentage'],
      template: '<div data-test="progress">{{ percentage }}</div>'
    }),
    useMessage: () => ({
      warning: messageWarningMock,
      success: messageSuccessMock,
      error: messageErrorMock
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixEncryptionService: {
    restoreFromBackup: restoreFromBackupMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn()
  })
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setInterval: setIntervalMock,
    clearInterval: clearIntervalMock,
    setTimeout: setTimeoutMock
  })
}))

describe('KeyBackupRestoreDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    intervalCallbackRef.current = null
    timeoutCallbackRef.current = null
    restoreFromBackupMock.mockResolvedValue({
      imported: 3,
      total: 3
    })
  })

  const mountComponent = () =>
    mount(KeyBackupRestoreDialog, {
      props: {
        show: true
      }
    })

  it('在恢复密钥为空时提示用户输入', async () => {
    const wrapper = mountComponent()

    await (wrapper.vm as any).handleRestore()

    expect(messageWarningMock).toHaveBeenCalledWith('请输入恢复密钥')
    expect(restoreFromBackupMock).not.toHaveBeenCalled()
  })

  it('恢复成功后更新进度并自动关闭弹窗', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).formData.recoveryKey = ' secret-key '

    const restorePromise = (wrapper.vm as any).handleRestore()
    intervalCallbackRef.current?.()
    await restorePromise
    await flushPromises()

    expect(restoreFromBackupMock).toHaveBeenCalledWith('secret-key')
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 200)
    expect(clearIntervalMock).toHaveBeenCalledWith(101)
    expect((wrapper.vm as any).restoreProgress).toBe(100)
    expect((wrapper.vm as any).restoreResult).toEqual({
      success: true,
      message: '成功恢复 3 个密钥'
    })
    expect(messageSuccessMock).toHaveBeenCalledWith('密钥恢复成功')
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 1500)

    timeoutCallbackRef.current?.()

    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(wrapper.emitted('success')).toEqual([[]])
    expect((wrapper.vm as any).formData.recoveryKey).toBe('')
  })

  it('恢复失败时清理进度定时器并显示错误结果', async () => {
    restoreFromBackupMock.mockRejectedValueOnce(new Error('restore failed'))

    const wrapper = mountComponent()
    ;(wrapper.vm as any).formData.recoveryKey = 'broken-key'

    await (wrapper.vm as any).handleRestore()

    expect(clearIntervalMock).toHaveBeenCalledWith(101)
    expect((wrapper.vm as any).restoreProgress).toBeNull()
    expect((wrapper.vm as any).restoreResult).toEqual({
      success: false,
      message: '恢复失败，请检查密钥是否正确'
    })
    expect(messageErrorMock).toHaveBeenCalledWith('恢复失败')
  })

  it('取消时重置表单和恢复状态', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).formData.recoveryKey = 'secret-key'
    ;(wrapper.vm as any).restoreProgress = 60
    ;(wrapper.vm as any).restoreResult = {
      success: true,
      message: 'ok'
    }

    ;(wrapper.vm as any).handleCancel()

    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect((wrapper.vm as any).formData.recoveryKey).toBe('')
    expect((wrapper.vm as any).restoreProgress).toBeNull()
    expect((wrapper.vm as any).restoreResult).toBeNull()
  })
})
