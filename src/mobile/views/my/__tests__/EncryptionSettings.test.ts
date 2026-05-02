import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EncryptionSettings from '../EncryptionSettings.vue'

const {
  getCurrentSessionContextMock,
  prepareKeyBackupVersionMock,
  getCurrentDeviceIdMock,
  getDevicesMock,
  deleteDeviceMock,
  getBackupVersionsMock,
  createBackupVersionMock,
  isDeviceVerifiedMock,
  startSasVerificationMock,
  showToastMock,
  showConfirmDialogMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  prepareKeyBackupVersionMock: vi.fn(),
  getCurrentDeviceIdMock: vi.fn(),
  getDevicesMock: vi.fn(),
  deleteDeviceMock: vi.fn(),
  getBackupVersionsMock: vi.fn(),
  createBackupVersionMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn(),
  startSasVerificationMock: vi.fn(),
  showToastMock: vi.fn(),
  showConfirmDialogMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('vant', async () => {
  const { defineComponent, h } = await import('vue')

  const passthroughStub = (name: string) =>
    defineComponent({
      name,
      props: {
        show: {
          type: Boolean,
          default: false
        },
        title: {
          type: String,
          default: ''
        }
      },
      emits: ['update:show', 'click', 'refresh', 'load'],
      setup(_, { slots, emit }) {
        return () =>
          h(
            'div',
            {
              'data-test': name,
              onClick: () => emit('click'),
              onRefresh: () => emit('refresh'),
              onLoad: () => emit('load')
            },
            slots.default?.()
          )
      }
    })

  const VanSwitch = defineComponent({
    name: 'VanSwitch',
    props: {
      modelValue: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            'data-test': 'van-switch',
            onClick: () => emit('update:modelValue', !props.modelValue)
          },
          'switch'
        )
    }
  })

  return {
    showToast: showToastMock,
    showConfirmDialog: showConfirmDialogMock,
    VanCellGroup: passthroughStub('van-cell-group'),
    VanCell: passthroughStub('van-cell'),
    VanTag: passthroughStub('van-tag'),
    VanPullRefresh: passthroughStub('van-pull-refresh'),
    VanList: passthroughStub('van-list'),
    VanButton: passthroughStub('van-button'),
    VanSwitch,
    VanActionSheet: defineComponent({
      name: 'VanActionSheet',
      props: {
        show: {
          type: Boolean,
          default: false
        },
        title: {
          type: String,
          default: ''
        }
      },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () =>
          props.show ? h('div', { 'data-test': 'van-action-sheet' }, [props.title, slots.default?.()]) : null
      }
    }),
    VanField: passthroughStub('van-field')
  }
})

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div data-test="auto-fix-height-page"><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div data-test="header-bar" />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

vi.mock('@/router', () => ({
  default: { push: vi.fn(), back: vi.fn() }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: getCurrentSessionContextMock,
    prepareKeyBackupVersion: prepareKeyBackupVersionMock
  }
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getCurrentDeviceId: getCurrentDeviceIdMock,
    getDevices: getDevicesMock,
    deleteDevice: deleteDeviceMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {
    getBackupVersions: getBackupVersionsMock,
    createBackupVersion: createBackupVersionMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    isDeviceVerified: isDeviceVerifiedMock,
    startSasVerification: startSasVerificationMock
  }
}))

describe('Mobile EncryptionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getCurrentSessionContextMock.mockReturnValue({
      userId: '@alice:example.com',
      deviceId: 'CURRENT_DEVICE',
      isCryptoEnabled: true
    })
    prepareKeyBackupVersionMock.mockResolvedValue({
      algorithm: 'm.megolm.backup.v1',
      authData: { public_key: 'pk' },
      privateKey: new Uint8Array([1, 2, 3])
    })
    getCurrentDeviceIdMock.mockReturnValue('CURRENT_DEVICE')
    getDevicesMock.mockResolvedValue([
      { device_id: 'CURRENT_DEVICE', display_name: 'Current Device' },
      { device_id: 'OTHER_DEVICE', display_name: 'Other Device', last_seen_ts: 1710000000000 }
    ])
    deleteDeviceMock.mockResolvedValue(undefined)
    getBackupVersionsMock.mockResolvedValue([{ version: '1', algorithm: 'm.megolm.backup.v1', auth_data: {} }])
    createBackupVersionMock.mockResolvedValue({
      version: '1',
      algorithm: 'm.megolm.backup.v1',
      auth_data: {}
    })
    isDeviceVerifiedMock.mockImplementation(async (_userId: string, deviceId: string) => deviceId === 'CURRENT_DEVICE')
    startSasVerificationMock.mockResolvedValue('txn-123')
    showConfirmDialogMock.mockResolvedValue(undefined)
  })

  const mountComponent = () =>
    mount(EncryptionSettings, {
      global: {
        stubs: {
          'van-cell-group': {
            template: '<div data-test="van-cell-group"><slot /></div>'
          },
          'van-cell': {
            props: ['title', 'value', 'label', 'isLink'],
            template:
              '<div data-test="van-cell"><span>{{ title }}</span><span>{{ value }}</span><span>{{ label }}</span><slot name="value" /><slot name="right-icon" /></div>'
          },
          'van-tag': {
            template: '<span data-test="van-tag"><slot /></span>'
          },
          'van-pull-refresh': {
            template: '<div data-test="van-pull-refresh"><slot /></div>'
          },
          'van-list': {
            template: '<div data-test="van-list"><slot /></div>'
          },
          'van-button': {
            template: '<button type="button" data-test="van-button"><slot /></button>'
          },
          'van-switch': {
            props: ['modelValue'],
            emits: ['update:modelValue'],
            template:
              '<button type="button" data-test="van-switch" @click="$emit(\'update:modelValue\', !modelValue)">switch</button>'
          },
          'van-action-sheet': {
            props: ['show', 'title'],
            template: '<div v-if="show" data-test="van-action-sheet"><span>{{ title }}</span><slot /></div>'
          }
        }
      }
    })

  it('挂载时加载加密状态、备份状态和设备列表', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    expect((wrapper.vm as any).encryptionEnabled).toBe(true)
    expect((wrapper.vm as any).deviceVerified).toBe(true)
    expect((wrapper.vm as any).backupEnabled).toBe(true)
    expect((wrapper.vm as any).currentDeviceId).toBe('CURRENT_DEVICE')
    expect((wrapper.vm as any).devices).toHaveLength(2)
    expect((wrapper.vm as any).devices[0].verified).toBe(true)
    expect((wrapper.vm as any).devices[1].verified).toBe(false)
    expect((wrapper.vm as any).encryptionStatusText).toBe('setting.encryption.encryption_enabled_desc')
    expect((wrapper.vm as any).backupStatusText).toBe('setting.encryption.backup_enabled_desc')
    expect(wrapper.text()).toContain('setting.encryption.encryption_enabled_desc')
    expect(wrapper.text()).toContain('setting.encryption.backup_enabled_desc')
    expect((wrapper.vm as any).formatLastSeen(1710000000000)).toBeTypeOf('string')
  })

  it('支持设备点击、验证和删除流程', async () => {
    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).handleDeviceClick((wrapper.vm as any).devices[1])
    await flushPromises()
    expect(wrapper.text()).toContain('setting.encryption.last_seen')
    expect(wrapper.text()).toContain('setting.encryption.verify')
    expect(wrapper.text()).toContain('common.delete')
    const vm = wrapper.vm as any
    await vm.handleVerifyDevice()
    await vm.handleDeleteDevice()
    await flushPromises()

    expect(startSasVerificationMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect(deleteDeviceMock).toHaveBeenCalledWith('OTHER_DEVICE')
    expect(showToastMock).toHaveBeenCalledWith('验证已开始，事务ID: txn-123')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.delete_device_success')
    expect((wrapper.vm as any).showDeviceSheet).toBe(false)
  })

  it('支持创建和查看密钥备份，并提供恢复提示', async () => {
    getBackupVersionsMock.mockResolvedValueOnce([])
    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).backupEnabled = false

    const vm = wrapper.vm as any
    await vm.handleBackupClick()
    ;(wrapper.vm as any).backupEnabled = true
    await vm.handleBackupClick()
    ;(wrapper.vm as any).handleRestoreBackup()

    expect(prepareKeyBackupVersionMock).toHaveBeenCalled()
    expect(createBackupVersionMock).toHaveBeenCalledWith('m.megolm.backup.v1', { public_key: 'pk' })
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.setup_backup')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.manage_backup: v1')
    expect((wrapper.vm as any).showRestoreDialog).toBe(true)
  })

  it('在加密不可用或操作失败时走降级提示', async () => {
    getCurrentSessionContextMock.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: false
    })
    prepareKeyBackupVersionMock.mockResolvedValue(null)
    getDevicesMock.mockRejectedValue(new Error('load failed'))

    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).backupEnabled = false
    const vm = wrapper.vm as any
    await vm.handleBackupClick()
    ;(wrapper.vm as any).selectedDevice = { device_id: 'DEVICE_X' }
    await vm.handleVerifyDevice()
    ;(wrapper.vm as any).onRefresh()
    await flushPromises()

    expect((wrapper.vm as any).encryptionEnabled).toBe(false)
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.load_devices_failed')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.disabled')
    expect((wrapper.vm as any).devices).toEqual([])
  })

  it('在会话和备份状态加载失败时回退到禁用状态', async () => {
    getCurrentSessionContextMock.mockImplementation(() => {
      throw new Error('context failed')
    })
    getBackupVersionsMock.mockRejectedValue(new Error('backup failed'))

    const wrapper = mountComponent()

    await flushPromises()

    expect((wrapper.vm as any).encryptionEnabled).toBe(false)
    expect((wrapper.vm as any).backupEnabled).toBe(false)
    expect((wrapper.vm as any).encryptionStatusText).toBe('setting.encryption.encryption_disabled_desc')
    expect((wrapper.vm as any).backupStatusText).toBe('setting.encryption.backup_disabled_desc')
  })

  it('在校验设备、验证设备和删除设备失败时提示兜底消息', async () => {
    isDeviceVerifiedMock.mockRejectedValue(new Error('verify status failed'))
    startSasVerificationMock.mockRejectedValue(new Error('verify failed'))
    deleteDeviceMock.mockRejectedValue(new Error('delete failed'))

    const wrapper = mountComponent()

    await flushPromises()
    expect((wrapper.vm as any).devices.every((item: any) => item.verified === false)).toBe(true)

    ;(wrapper.vm as any).handleDeviceClick((wrapper.vm as any).devices[1])
    const vm = wrapper.vm as any
    await vm.handleVerifyDevice()
    await vm.handleDeleteDevice()

    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.verify_device_todo')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.delete_device_failed')
  })

  it('在删除取消和备份异常时按预期处理', async () => {
    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).selectedDevice = { device_id: 'OTHER_DEVICE' }
    showConfirmDialogMock.mockRejectedValueOnce('cancel')
    const vm = wrapper.vm as any
    await vm.handleDeleteDevice()

    ;(wrapper.vm as any).backupEnabled = true
    getBackupVersionsMock.mockRejectedValueOnce(new Error('manage failed'))
    await vm.handleBackupClick()

    ;(wrapper.vm as any).backupEnabled = false
    prepareKeyBackupVersionMock.mockRejectedValueOnce(new Error('prepare failed'))
    await vm.handleBackupClick()

    expect(showToastMock).not.toHaveBeenCalledWith('setting.encryption.delete_device_failed')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.manage_backup_todo')
    expect(showToastMock).toHaveBeenCalledWith('setting.encryption.setup_backup_todo')
  })

  it('当前设备已验证时隐藏设备操作按钮', async () => {
    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).handleDeviceClick({
      device_id: 'CURRENT_DEVICE',
      display_name: 'Current Device',
      verified: true
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Current Device')
    expect(wrapper.text()).not.toContain('setting.encryption.verify')
    expect(wrapper.text()).not.toContain('common.delete')
  })
})
