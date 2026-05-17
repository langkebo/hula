import { type DeviceInfo, matrixAccountService } from '@/services/matrix/user/MatrixAccountService'

export type { DeviceInfo }

interface AuthData {
  type?: string
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

  const getThreePids = () => {
    return matrixAccountService.getThreePids()
  }

  const addThreePid = (sid: string, clientSecret: string, bind?: boolean) => {
    return matrixAccountService.addThreePid(sid, clientSecret, bind)
  }

  const bindThreePid = (sid: string, clientSecret: string, medium: string, address: string) => {
    return matrixAccountService.bindThreePid(sid, clientSecret, medium, address)
  }

  const deleteThreePid = (medium: string, address: string) => {
    return matrixAccountService.deleteThreePid(medium, address)
  }

  const unbindThreePid = (medium: string, address: string) => {
    return matrixAccountService.unbindThreePid(medium, address)
  }

  const requestEmailTokenFor3Pid = (email: string, clientSecret: string, sendAttempt?: number) => {
    return matrixAccountService.requestEmailTokenFor3Pid(email, clientSecret, sendAttempt)
  }

  const requestMsisdnTokenFor3Pid = (
    countryCode: string,
    phoneNumber: string,
    clientSecret: string,
    sendAttempt?: number
  ) => {
    return matrixAccountService.requestMsisdnTokenFor3Pid(countryCode, phoneNumber, clientSecret, sendAttempt)
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

  const setPresence = (presence: 'online' | 'offline' | 'unavailable' | 'away', statusMessage?: string) => {
    return matrixAccountService.setPresence(presence, statusMessage)
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
    getThreePids,
    addThreePid,
    bindThreePid,
    deleteThreePid,
    unbindThreePid,
    requestEmailTokenFor3Pid,
    requestMsisdnTokenFor3Pid,
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
