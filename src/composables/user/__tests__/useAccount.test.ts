import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUpdateDisplayName,
  mockUpdateAvatar,
  mockChangePassword,
  mockGetDevices,
  mockGetDevice,
  mockSetDeviceName,
  mockDeleteDevice,
  mockDeleteDevices,
  mockDeactivateAccount,
  mockGetIgnoredUsers,
  mockSetIgnoredUsers,
  mockSetPresence,
  mockGetCapabilities,
  mockGetThirdPartyProtocols,
  mockGetMyRooms,
  mockGetEventStream
} = vi.hoisted(() => ({
  mockUpdateDisplayName: vi.fn(),
  mockUpdateAvatar: vi.fn(),
  mockChangePassword: vi.fn(),
  mockGetDevices: vi.fn(),
  mockGetDevice: vi.fn(),
  mockSetDeviceName: vi.fn(),
  mockDeleteDevice: vi.fn(),
  mockDeleteDevices: vi.fn(),
  mockDeactivateAccount: vi.fn(),
  mockGetIgnoredUsers: vi.fn(),
  mockSetIgnoredUsers: vi.fn(),
  mockSetPresence: vi.fn(),
  mockGetCapabilities: vi.fn(),
  mockGetThirdPartyProtocols: vi.fn(),
  mockGetMyRooms: vi.fn(),
  mockGetEventStream: vi.fn()
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    updateDisplayName: mockUpdateDisplayName,
    updateAvatar: mockUpdateAvatar,
    changePassword: mockChangePassword,
    getDevices: mockGetDevices,
    getDevice: mockGetDevice,
    setDeviceName: mockSetDeviceName,
    deleteDevice: mockDeleteDevice,
    deleteDevices: mockDeleteDevices,
    deactivateAccount: mockDeactivateAccount,
    getIgnoredUsers: mockGetIgnoredUsers,
    setIgnoredUsers: mockSetIgnoredUsers,
    getCapabilities: mockGetCapabilities,
    getThirdPartyProtocols: mockGetThirdPartyProtocols,
    getMyRooms: mockGetMyRooms,
    getEventStream: mockGetEventStream
  }
}))

// setPresence 已从 MatrixAccountService 删除，委托给唯一门控写入点
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: mockSetPresence }
}))

import { useAccount } from '../useAccount'

describe('useAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('profile updates', () => {
    it('updateDisplayName delegates to service', async () => {
      mockUpdateDisplayName.mockResolvedValueOnce(undefined)
      const { updateDisplayName } = useAccount()
      await updateDisplayName('Alice')
      expect(mockUpdateDisplayName).toHaveBeenCalledWith('Alice')
    })

    it('updateAvatar delegates to service', async () => {
      mockUpdateAvatar.mockResolvedValueOnce(undefined)
      const { updateAvatar } = useAccount()
      await updateAvatar('mxc://server/abc')
      expect(mockUpdateAvatar).toHaveBeenCalledWith('mxc://server/abc')
    })

    it('updateDisplayName propagates error', async () => {
      mockUpdateDisplayName.mockRejectedValueOnce(new Error('invalid name'))
      const { updateDisplayName } = useAccount()
      await expect(updateDisplayName('')).rejects.toThrow('invalid name')
    })

    it('updateAvatar propagates error', async () => {
      mockUpdateAvatar.mockRejectedValueOnce(new Error('invalid url'))
      const { updateAvatar } = useAccount()
      await expect(updateAvatar('bad-url')).rejects.toThrow('invalid url')
    })
  })

  describe('password change', () => {
    it('changePassword delegates with all params', async () => {
      mockChangePassword.mockResolvedValueOnce(undefined)
      const { changePassword } = useAccount()
      await changePassword('oldPw', 'newPw', true)
      expect(mockChangePassword).toHaveBeenCalledWith('oldPw', 'newPw', true)
    })

    it('changePassword without logoutDevices', async () => {
      mockChangePassword.mockResolvedValueOnce(undefined)
      const { changePassword } = useAccount()
      await changePassword('oldPw', 'newPw')
      expect(mockChangePassword).toHaveBeenCalledWith('oldPw', 'newPw', undefined)
    })

    it('changePassword propagates error', async () => {
      mockChangePassword.mockRejectedValueOnce(new Error('wrong password'))
      const { changePassword } = useAccount()
      await expect(changePassword('wrong', 'new')).rejects.toThrow('wrong password')
    })
  })

  describe('device management', () => {
    it('getDevices returns device list', async () => {
      const devices = [{ deviceId: 'DEV1', displayName: 'Phone' }]
      mockGetDevices.mockResolvedValueOnce(devices)
      const { getDevices } = useAccount()
      const result = await getDevices()
      expect(result).toEqual(devices)
    })

    it('getDevice returns single device', async () => {
      const device = { deviceId: 'DEV1', displayName: 'Phone' }
      mockGetDevice.mockResolvedValueOnce(device)
      const { getDevice } = useAccount()
      const result = await getDevice('DEV1')
      expect(result).toEqual(device)
      expect(mockGetDevice).toHaveBeenCalledWith('DEV1')
    })

    it('setDeviceName delegates to service', async () => {
      mockSetDeviceName.mockResolvedValueOnce(undefined)
      const { setDeviceName } = useAccount()
      await setDeviceName('DEV1', 'My Laptop')
      expect(mockSetDeviceName).toHaveBeenCalledWith('DEV1', 'My Laptop')
    })

    it('deleteDevice without authData', async () => {
      mockDeleteDevice.mockResolvedValueOnce(undefined)
      const { deleteDevice } = useAccount()
      await deleteDevice('DEV1')
      expect(mockDeleteDevice).toHaveBeenCalledWith('DEV1', undefined)
    })

    it('deleteDevice with authData', async () => {
      mockDeleteDevice.mockResolvedValueOnce(undefined)
      const { deleteDevice } = useAccount()
      const authData = { type: 'm.login.password', user: '@a:s', password: 'pw', session: 'sess' }
      await deleteDevice('DEV1', authData)
      expect(mockDeleteDevice).toHaveBeenCalledWith('DEV1', authData)
    })

    it('deleteDevices with multiple ids', async () => {
      mockDeleteDevices.mockResolvedValueOnce(undefined)
      const { deleteDevices } = useAccount()
      await deleteDevices(['DEV1', 'DEV2'])
      expect(mockDeleteDevices).toHaveBeenCalledWith(['DEV1', 'DEV2'], undefined)
    })

    it('deleteDevices with authData', async () => {
      mockDeleteDevices.mockResolvedValueOnce(undefined)
      const { deleteDevices } = useAccount()
      const authData = { type: 'm.login.password', password: 'pw' }
      await deleteDevices(['DEV1'], authData)
      expect(mockDeleteDevices).toHaveBeenCalledWith(['DEV1'], authData)
    })

    it('deleteDevices with empty array', async () => {
      mockDeleteDevices.mockResolvedValueOnce(undefined)
      const { deleteDevices } = useAccount()
      await deleteDevices([])
      expect(mockDeleteDevices).toHaveBeenCalledWith([], undefined)
    })

    it('deleteDevice propagates error', async () => {
      mockDeleteDevice.mockRejectedValueOnce(new Error('not found'))
      const { deleteDevice } = useAccount()
      await expect(deleteDevice('UNKNOWN')).rejects.toThrow('not found')
    })
  })

  describe('account deactivation', () => {
    it('deactivateAccount without params', async () => {
      mockDeactivateAccount.mockResolvedValueOnce(undefined)
      const { deactivateAccount } = useAccount()
      await deactivateAccount()
      expect(mockDeactivateAccount).toHaveBeenCalledWith(undefined, undefined)
    })

    it('deactivateAccount with authData and erase', async () => {
      mockDeactivateAccount.mockResolvedValueOnce(undefined)
      const { deactivateAccount } = useAccount()
      const authData = { type: 'm.login.password', password: 'pw' }
      await deactivateAccount(authData, true)
      expect(mockDeactivateAccount).toHaveBeenCalledWith(authData, true)
    })

    it('deactivateAccount propagates error', async () => {
      mockDeactivateAccount.mockRejectedValueOnce(new Error('auth required'))
      const { deactivateAccount } = useAccount()
      await expect(deactivateAccount()).rejects.toThrow('auth required')
    })
  })

  describe('ignored users', () => {
    it('getIgnoredUsers returns user list', async () => {
      mockGetIgnoredUsers.mockResolvedValueOnce(['@spam:server'])
      const { getIgnoredUsers } = useAccount()
      const result = await getIgnoredUsers()
      expect(result).toEqual(['@spam:server'])
    })

    it('setIgnoredUsers delegates to service', async () => {
      mockSetIgnoredUsers.mockResolvedValueOnce(undefined)
      const { setIgnoredUsers } = useAccount()
      await setIgnoredUsers(['@spam:server', '@abuse:server'])
      expect(mockSetIgnoredUsers).toHaveBeenCalledWith(['@spam:server', '@abuse:server'])
    })

    it('setIgnoredUsers with empty array clears list', async () => {
      mockSetIgnoredUsers.mockResolvedValueOnce(undefined)
      const { setIgnoredUsers } = useAccount()
      await setIgnoredUsers([])
      expect(mockSetIgnoredUsers).toHaveBeenCalledWith([])
    })
  })

  describe('presence', () => {
    it('setPresence delegates to the gated presence service with status message', async () => {
      mockSetPresence.mockResolvedValueOnce('online')
      const { setPresence } = useAccount()
      const effective = await setPresence('online', 'Working')
      expect(mockSetPresence).toHaveBeenCalledWith('online', 'Working')
      expect(effective).toBe('online')
    })

    it('setPresence returns the effective presence decided by the service', async () => {
      // 开关关闭时服务把 online 降级为 offline，调用方拿到生效值
      mockSetPresence.mockResolvedValueOnce('offline')
      const { setPresence } = useAccount()
      const effective = await setPresence('online')
      expect(mockSetPresence).toHaveBeenCalledWith('online', undefined)
      expect(effective).toBe('offline')
    })

    it('setPresence forwards unavailable (away/busy 映射) as-is', async () => {
      mockSetPresence.mockResolvedValueOnce('unavailable')
      const { setPresence } = useAccount()
      const effective = await setPresence('unavailable', 'On vacation')
      expect(mockSetPresence).toHaveBeenCalledWith('unavailable', 'On vacation')
      expect(effective).toBe('unavailable')
    })
  })

  describe('capabilities & protocols', () => {
    it('getCapabilities returns capabilities', async () => {
      const caps = { 'm.change_password': { enabled: true } }
      mockGetCapabilities.mockResolvedValueOnce(caps)
      const { getCapabilities } = useAccount()
      const result = await getCapabilities()
      expect(result).toEqual(caps)
    })

    it('getThirdPartyProtocols returns protocols', async () => {
      const protocols = { irc: { instances: [] } }
      mockGetThirdPartyProtocols.mockResolvedValueOnce(protocols)
      const { getThirdPartyProtocols } = useAccount()
      const result = await getThirdPartyProtocols()
      expect(result).toEqual(protocols)
    })
  })

  describe('rooms & event stream', () => {
    it('getMyRooms returns room list', async () => {
      const rooms = [{ roomId: '!r1' }, { roomId: '!r2' }]
      mockGetMyRooms.mockResolvedValueOnce(rooms)
      const { getMyRooms } = useAccount()
      const result = await getMyRooms()
      expect(result).toEqual(rooms)
    })

    it('getEventStream with from and timeout', async () => {
      const stream = { chunk: [] }
      mockGetEventStream.mockResolvedValueOnce(stream)
      const { getEventStream } = useAccount()
      const result = await getEventStream('token123', 30000)
      expect(result).toEqual(stream)
      expect(mockGetEventStream).toHaveBeenCalledWith('token123', 30000)
    })

    it('getEventStream without params', async () => {
      const stream = { chunk: [] }
      mockGetEventStream.mockResolvedValueOnce(stream)
      const { getEventStream } = useAccount()
      const result = await getEventStream()
      expect(result).toEqual(stream)
      expect(mockGetEventStream).toHaveBeenCalledWith(undefined, undefined)
    })
  })

  describe('error handling - additional paths', () => {
    it('getDevices propagates error', async () => {
      mockGetDevices.mockRejectedValueOnce(new Error('fetch devices failed'))
      const { getDevices } = useAccount()
      await expect(getDevices()).rejects.toThrow('fetch devices failed')
    })

    it('getDevice propagates error', async () => {
      mockGetDevice.mockRejectedValueOnce(new Error('device not found'))
      const { getDevice } = useAccount()
      await expect(getDevice('UNKNOWN')).rejects.toThrow('device not found')
    })

    it('setDeviceName propagates error', async () => {
      mockSetDeviceName.mockRejectedValueOnce(new Error('rename failed'))
      const { setDeviceName } = useAccount()
      await expect(setDeviceName('DEV1', 'New Name')).rejects.toThrow('rename failed')
    })

    it('deleteDevices propagates error', async () => {
      mockDeleteDevices.mockRejectedValueOnce(new Error('batch delete failed'))
      const { deleteDevices } = useAccount()
      await expect(deleteDevices(['DEV1', 'DEV2'])).rejects.toThrow('batch delete failed')
    })

    it('getIgnoredUsers propagates error', async () => {
      mockGetIgnoredUsers.mockRejectedValueOnce(new Error('ignored fetch failed'))
      const { getIgnoredUsers } = useAccount()
      await expect(getIgnoredUsers()).rejects.toThrow('ignored fetch failed')
    })

    it('setIgnoredUsers propagates error', async () => {
      mockSetIgnoredUsers.mockRejectedValueOnce(new Error('set ignored failed'))
      const { setIgnoredUsers } = useAccount()
      await expect(setIgnoredUsers(['@spam:server'])).rejects.toThrow('set ignored failed')
    })

    it('setPresence propagates error', async () => {
      mockSetPresence.mockRejectedValueOnce(new Error('presence failed'))
      const { setPresence } = useAccount()
      await expect(setPresence('online')).rejects.toThrow('presence failed')
    })

    it('getCapabilities propagates error', async () => {
      mockGetCapabilities.mockRejectedValueOnce(new Error('caps failed'))
      const { getCapabilities } = useAccount()
      await expect(getCapabilities()).rejects.toThrow('caps failed')
    })

    it('getThirdPartyProtocols propagates error', async () => {
      mockGetThirdPartyProtocols.mockRejectedValueOnce(new Error('protocols failed'))
      const { getThirdPartyProtocols } = useAccount()
      await expect(getThirdPartyProtocols()).rejects.toThrow('protocols failed')
    })

    it('getMyRooms propagates error', async () => {
      mockGetMyRooms.mockRejectedValueOnce(new Error('rooms fetch failed'))
      const { getMyRooms } = useAccount()
      await expect(getMyRooms()).rejects.toThrow('rooms fetch failed')
    })

    it('getEventStream propagates error', async () => {
      mockGetEventStream.mockRejectedValueOnce(new Error('stream failed'))
      const { getEventStream } = useAccount()
      await expect(getEventStream()).rejects.toThrow('stream failed')
    })
  })
})
