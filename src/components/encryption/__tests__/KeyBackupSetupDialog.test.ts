import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KeyBackupSetupDialog from '../KeyBackupSetupDialog.vue'

const {
  setupKeyBackupMock,
  getKeyBackupInfoMock,
  messageSuccessMock,
  messageErrorMock,
  writeTextMock,
  createObjectURLMock,
  revokeObjectURLMock,
  appendChildMock,
  removeChildMock,
  clickMock
} = vi.hoisted(() => ({
  setupKeyBackupMock: vi.fn(),
  getKeyBackupInfoMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
  writeTextMock: vi.fn(),
  createObjectURLMock: vi.fn(),
  revokeObjectURLMock: vi.fn(),
  appendChildMock: vi.fn(),
  removeChildMock: vi.fn(),
  clickMock: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: { type: Boolean, default: false },
        title: { type: String, default: '' }
      },
      emits: ['update:show'],
      template: '<div v-if="show" data-test="modal"><span>{{ title }}</span><slot /></div>'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /><slot name="icon" /></button>'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      template: '<div data-test="spin"><slot /></div>'
    }),
    NCheckbox: defineComponent({
      name: 'NCheckbox',
      props: {
        checked: { type: Boolean, default: false }
      },
      emits: ['update:checked'],
      template: '<input type="checkbox" :checked="checked" @change="$emit(\'update:checked\', !checked)" />'
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value'],
      emits: ['update:value'],
      template: '<textarea />'
    }),
    useMessage: () => ({
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
    setupKeyBackup: setupKeyBackupMock,
    getKeyBackupInfo: getKeyBackupInfoMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn()
  })
}))

describe('KeyBackupSetupDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetAllMocks()

    setupKeyBackupMock.mockResolvedValue('RECOVERY-KEY-123')
    getKeyBackupInfoMock.mockResolvedValue({
      version: '1',
      algorithm: 'm.megolm.backup.v1',
      authData: {},
      count: 1,
      etag: 'etag'
    })
    writeTextMock.mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    })

    createObjectURLMock.mockReturnValue('blob:test-url')
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock
    })

    appendChildMock.mockImplementation(() => undefined)
    removeChildMock.mockImplementation(() => undefined)
    clickMock.mockImplementation(() => undefined)

    const originalCreateElement = document.createElement.bind(document)

    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as any)
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as any)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: clickMock
        } as any
      }
      return originalCreateElement(tagName)
    }) as typeof document.createElement)
  })

  const mountComponent = () =>
    mount(KeyBackupSetupDialog, {
      props: {
        show: true
      }
    })

  it('支持从创建备份到验证成功的完整流程', async () => {
    const wrapper = mountComponent()

    await (wrapper.vm as any).startSetup()

    expect(setupKeyBackupMock).toHaveBeenCalled()
    expect((wrapper.vm as any).step).toBe('showKey')
    expect((wrapper.vm as any).recoveryKey).toBe('RECOVERY-KEY-123')
    expect((wrapper.vm as any).dialogTitle).toBe('保存恢复密钥')

    ;(wrapper.vm as any).keySaved = true
    ;(wrapper.vm as any).confirmSetup()
    ;(wrapper.vm as any).verifyKey = 'RECOVERY-KEY-123'
    await (wrapper.vm as any).verifyKeyInput()

    expect(getKeyBackupInfoMock).toHaveBeenCalled()
    expect((wrapper.vm as any).step).toBe('success')
    expect((wrapper.vm as any).dialogTitle).toBe('设置完成')
    expect(messageSuccessMock).toHaveBeenCalledWith('安全备份验证成功')

    ;(wrapper.vm as any).handleClose()

    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect(wrapper.emitted('success')).toEqual([[]])
  })

  it('支持复制和下载恢复密钥', async () => {
    writeTextMock.mockResolvedValue(undefined)
    const wrapper = mountComponent()
    ;(wrapper.vm as any).recoveryKey = 'RECOVERY-KEY-123'

    await (wrapper.vm as any).copyKey()
    ;(wrapper.vm as any).downloadKey()

    expect(writeTextMock).toHaveBeenCalledWith('RECOVERY-KEY-123')
    expect(messageSuccessMock).toHaveBeenCalledWith('恢复密钥已复制到剪贴板')
    expect(createObjectURLMock).toHaveBeenCalled()
    expect(appendChildMock).toHaveBeenCalled()
    expect(clickMock).toHaveBeenCalled()
    expect(removeChildMock).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')
    expect(messageSuccessMock).toHaveBeenCalledWith('恢复密钥已下载')
  })

  it('在创建、复制或验证失败时给出兜底提示', async () => {
    setupKeyBackupMock.mockRejectedValueOnce(new Error('setup failed'))
    writeTextMock.mockRejectedValueOnce(new Error('copy failed'))
    getKeyBackupInfoMock.mockRejectedValueOnce(new Error('verify failed'))

    const wrapper = mountComponent()

    await (wrapper.vm as any).startSetup()
    expect((wrapper.vm as any).step).toBe('intro')
    expect(messageErrorMock).toHaveBeenCalledWith('创建安全备份失败，请稍后重试')

    ;(wrapper.vm as any).recoveryKey = 'RECOVERY-KEY-123'
    await (wrapper.vm as any).copyKey()
    await flushPromises()
    expect(messageErrorMock).toHaveBeenCalledWith('复制失败，请手动复制')

    ;(wrapper.vm as any).step = 'verify'
    ;(wrapper.vm as any).recoveryKey = 'RECOVERY-KEY-123'
    ;(wrapper.vm as any).verifyKey = 'RECOVERY-KEY-123'
    await (wrapper.vm as any).verifyKeyInput()

    expect(messageErrorMock).toHaveBeenCalledWith('验证备份失败')
  })

  it('在密钥不匹配或备份信息缺失时阻止完成设置', async () => {
    getKeyBackupInfoMock.mockResolvedValueOnce(null)
    const wrapper = mountComponent()

    ;(wrapper.vm as any).recoveryKey = 'RECOVERY-KEY-123'
    ;(wrapper.vm as any).verifyKey = 'WRONG-KEY'
    await (wrapper.vm as any).verifyKeyInput()

    expect(messageErrorMock).toHaveBeenCalledWith('密钥不匹配，请重新输入')

    ;(wrapper.vm as any).verifyKey = 'RECOVERY-KEY-123'
    await (wrapper.vm as any).verifyKeyInput()

    expect((wrapper.vm as any).step).toBe('intro')
    expect(messageErrorMock).toHaveBeenCalledWith('备份验证失败，请重试')
  })

  it('取消时重置内部状态', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).step = 'verify'
    ;(wrapper.vm as any).recoveryKey = 'RECOVERY-KEY-123'
    ;(wrapper.vm as any).keySaved = true
    ;(wrapper.vm as any).verifyKey = 'RECOVERY-KEY-123'

    ;(wrapper.vm as any).handleCancel()

    expect(wrapper.emitted('update:show')).toEqual([[false]])
    expect((wrapper.vm as any).step).toBe('intro')
    expect((wrapper.vm as any).recoveryKey).toBe('')
    expect((wrapper.vm as any).keySaved).toBe(false)
    expect((wrapper.vm as any).verifyKey).toBe('')
  })
})
