import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import type { PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'

interface AuthData {
  type: string
  user?: string
  password?: string
  session?: string
  [key: string]: unknown
}

export function useAccount() {
  const updateDisplayName = (displayName: string) => {
    return matrixAccountService.updateDisplayName(displayName)
  }

  const updateAvatar = (avatarUrl: string) => {
    return matrixAccountService.updateAvatar(avatarUrl)
  }

  const changePassword = (oldPassword: string, newPassword: string, logoutDevices?: boolean) => {
    return matrixAccountService.changePassword(oldPassword, newPassword, logoutDevices)
  }

  const getDevices = () => {
    return matrixAccountService.getDevices()
  }

  const getDevice = (deviceId: string) => {
    return matrixAccountService.getDevice(deviceId)
  }

  const setDeviceName = (deviceId: string, displayName: string) => {
    return matrixAccountService.setDeviceName(deviceId, displayName)
  }

  const deleteDevice = (deviceId: string, authData?: AuthData) => {
    return matrixAccountService.deleteDevice(deviceId, authData)
  }

  const deleteDevices = (deviceIds: string[], authData?: AuthData) => {
    return matrixAccountService.deleteDevices(deviceIds, authData)
  }

  const deactivateAccount = (authData?: AuthData, erase?: boolean) => {
    return matrixAccountService.deactivateAccount(authData, erase)
  }

  const getIgnoredUsers = () => {
    return matrixAccountService.getIgnoredUsers()
  }

  const setIgnoredUsers = (userIds: string[]) => {
    return matrixAccountService.setIgnoredUsers(userIds)
  }

  /** 委托唯一门控 presence 服务：这里不再提供任何绕过门控的入口 */
  const setPresence = (presence: PresenceState, statusMessage?: string) => {
    return matrixPresenceService.setPresence(presence, statusMessage)
  }

  const getCapabilities = () => {
    return matrixAccountService.getCapabilities()
  }

  const getThirdPartyProtocols = () => {
    return matrixAccountService.getThirdPartyProtocols()
  }

  const getMyRooms = () => {
    return matrixAccountService.getMyRooms()
  }

  const getEventStream = (from?: string, timeout?: number) => {
    return matrixAccountService.getEventStream(from, timeout)
  }

  return {
    updateDisplayName,
    updateAvatar,
    changePassword,
    getDevices,
    getDevice,
    setDeviceName,
    deleteDevice,
    deleteDevices,
    deactivateAccount,
    getIgnoredUsers,
    setIgnoredUsers,
    setPresence,
    getCapabilities,
    getThirdPartyProtocols,
    getMyRooms,
    getEventStream
  }
}
