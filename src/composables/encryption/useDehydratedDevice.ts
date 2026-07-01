import { type Ref, ref } from 'vue'
import {
  type CreateDehydratedDeviceParams,
  type DehydratedDevice,
  matrixDehydratedDeviceService
} from '@/services/matrix/crypto/MatrixDehydratedDeviceService'

export type { CreateDehydratedDeviceParams, DehydratedDevice }

export interface UseDehydratedDeviceResult {
  devices: Ref<DehydratedDevice[]>
  loading: Ref<boolean>
  loadDehydratedDevices: () => Promise<DehydratedDevice[]>
  createDehydratedDevice: (params?: CreateDehydratedDeviceParams) => Promise<DehydratedDevice | null>
  claimDehydratedDevice: (
    deviceId: string,
    signingPubKey: string
  ) => Promise<{ accessToken: string; deviceId: string } | null>
  deleteDehydratedDevice: (deviceId: string) => Promise<boolean>
  getDehydratedDeviceKey: (deviceId: string) => Promise<DehydratedDevice | null>
}

export function useDehydratedDevice(): UseDehydratedDeviceResult {
  const devices = ref<DehydratedDevice[]>([])
  const loading = ref(false)

  async function loadDehydratedDevices(): Promise<DehydratedDevice[]> {
    loading.value = true
    try {
      const result = await matrixDehydratedDeviceService.getDevices()
      devices.value = result
      return result
    } finally {
      loading.value = false
    }
  }

  async function createDehydratedDevice(params?: CreateDehydratedDeviceParams): Promise<DehydratedDevice | null> {
    loading.value = true
    try {
      const result = await matrixDehydratedDeviceService.createDevice(
        params || { initialDeviceDisplayName: 'Hula Dehydrated Device' }
      )
      if (result) {
        devices.value = [...devices.value, result]
      }
      return result
    } finally {
      loading.value = false
    }
  }

  async function claimDehydratedDevice(
    deviceId: string,
    signingPubKey: string
  ): Promise<{ accessToken: string; deviceId: string } | null> {
    loading.value = true
    try {
      const result = await matrixDehydratedDeviceService.claimDevice(deviceId, signingPubKey)
      if (result) {
        devices.value = devices.value.filter((d) => d.deviceId !== deviceId)
      }
      return result
    } finally {
      loading.value = false
    }
  }

  async function deleteDehydratedDevice(deviceId: string): Promise<boolean> {
    loading.value = true
    try {
      const success = await matrixDehydratedDeviceService.deleteDevice(deviceId)
      if (success) {
        devices.value = devices.value.filter((d) => d.deviceId !== deviceId)
      }
      return success
    } finally {
      loading.value = false
    }
  }

  async function getDehydratedDeviceKey(deviceId: string): Promise<DehydratedDevice | null> {
    return matrixDehydratedDeviceService.getDevice(deviceId)
  }

  return {
    devices,
    loading,
    loadDehydratedDevices,
    createDehydratedDevice,
    claimDehydratedDevice,
    deleteDehydratedDevice,
    getDehydratedDeviceKey
  }
}
