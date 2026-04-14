/* eslint-disable @typescript-eslint/no-explicit-any */
import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface KeyRotationStatus {
  needs_rotation: boolean
  last_rotation_ts: number
  current_version: string
  devices_pending: number
}

export interface KeyRotationConfig {
  auto_rotate: boolean
  rotation_interval_ms: number
  max_key_age_ms: number
}

export interface KeyRotationHistory {
  device_id: string
  rotation_ts: number
  old_version: string
  new_version: string
  reason: string
}

const DEFAULT_ROTATION_STATUS: KeyRotationStatus = {
  needs_rotation: false,
  last_rotation_ts: 0,
  current_version: '',
  devices_pending: 0
}

const DEFAULT_ROTATION_CONFIG: KeyRotationConfig = {
  auto_rotate: false,
  rotation_interval_ms: 0,
  max_key_age_ms: 0
}

class MatrixKeyRotationService extends BaseManager {
  private keyRotationManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.keyRotationManager = (client as any).getKeyRotationManager?.() ?? null
      this.initialized = true
    } catch (_err) {}
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  async getRotationStatus(throwOnError = true): Promise<KeyRotationStatus> {
    try {
      if (this.keyRotationManager) {
        const status = await this.keyRotationManager.getRotationStatus()
        return {
          needs_rotation: status.needs_rotation ?? status.needsRotation ?? false,
          last_rotation_ts: status.last_rotation_ts ?? status.lastRotationTs ?? 0,
          current_version: status.current_version ?? status.currentVersion ?? '',
          devices_pending: status.devices_pending ?? status.devicesPending ?? 0
        }
      }

      const response = await this.client.http.authedRequest(
        Method.Get,
        '/_matrix/client/v1/keys/rotation/status',
        undefined,
        undefined,
        { prefix: '' }
      )
      return {
        needs_rotation: response.needs_rotation ?? false,
        last_rotation_ts: response.last_rotation_ts ?? 0,
        current_version: response.current_version ?? '',
        devices_pending: response.devices_pending ?? 0
      }
    } catch (error) {
      return this.handleError(error, 'getRotationStatus', DEFAULT_ROTATION_STATUS, throwOnError)
    }
  }

  async rotateKeys(throwOnError = false): Promise<boolean> {
    try {
      if (this.keyRotationManager) {
        await this.keyRotationManager.rotateKeys()
        return true
      }

      await this.client.http.authedRequest(
        Method.Post,
        '/_matrix/client/v1/keys/rotation/rotate',
        undefined,
        {},
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'rotateKeys', false, throwOnError)
    }
  }

  async getRotationHistory(deviceId: string, throwOnError = true): Promise<KeyRotationHistory[]> {
    try {
      if (this.keyRotationManager) {
        const history = await this.keyRotationManager.getRotationHistory(deviceId)
        return history ?? []
      }

      const response = await this.client.http.authedRequest(
        Method.Get,
        `/_matrix/client/v1/keys/rotation/history/${encodeURIComponent(deviceId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return response?.history ?? []
    } catch (error) {
      return this.handleError(error, 'getRotationHistory', [] as KeyRotationHistory[], throwOnError)
    }
  }

  async checkNeedsRotation(throwOnError = true): Promise<boolean> {
    try {
      if (this.keyRotationManager) {
        const result = await this.keyRotationManager.checkNeedsRotation()
        return result?.needs_rotation ?? result ?? false
      }

      const response = await this.client.http.authedRequest(
        Method.Get,
        '/_matrix/client/v1/keys/rotation/check',
        undefined,
        undefined,
        { prefix: '' }
      )
      return response?.needs_rotation ?? false
    } catch (error) {
      return this.handleError(error, 'checkNeedsRotation', false, throwOnError)
    }
  }

  async getRotationConfig(throwOnError = true): Promise<KeyRotationConfig> {
    try {
      if (this.keyRotationManager) {
        return await this.keyRotationManager.getRotationConfig()
      }

      const response = await this.client.http.authedRequest(
        Method.Get,
        '/_matrix/client/v1/keys/rotation/config',
        undefined,
        undefined,
        { prefix: '' }
      )
      return response ?? DEFAULT_ROTATION_CONFIG
    } catch (error) {
      return this.handleError(error, 'getRotationConfig', DEFAULT_ROTATION_CONFIG, throwOnError)
    }
  }

  async updateRotationConfig(config: Partial<KeyRotationConfig>, throwOnError = false): Promise<boolean> {
    try {
      if (this.keyRotationManager) {
        await this.keyRotationManager.updateRotationConfig(config)
        return true
      }

      await this.client.http.authedRequest(Method.Put, '/_matrix/client/v1/keys/rotation/config', undefined, config, {
        prefix: ''
      })
      return true
    } catch (error) {
      return this.handleError(error, 'updateRotationConfig', false, throwOnError)
    }
  }
}

const matrixKeyRotationService = new MatrixKeyRotationService()
export default matrixKeyRotationService
