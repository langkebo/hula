/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
export interface GuestInfo {
  userId: string
  deviceId: string
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface ServerGuestInfo {
  user_id: string
  device_id: string
  is_guest: boolean
  created_at?: number
}

export interface GuestRegisterResponse {
  user_id: string
  device_id: string
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export interface UpgradeGuestRequest {
  username?: string
  password: string
}

class MatrixGuestService extends BaseManager {
  private guestManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.guestManager = (client as any).getGuestManager?.() ?? null
      if (this.guestManager) {
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_err) {}
  }

  async registerGuest(deviceId?: string, displayName?: string): Promise<GuestRegisterResponse | null> {
    if (this.guestManager) {
      try {
        const response = await this.guestManager.registerGuestOnServer(deviceId, displayName)
        return response
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async loginGuest(deviceId?: string, displayName?: string): Promise<GuestRegisterResponse | null> {
    if (this.guestManager) {
      try {
        const response = await this.guestManager.loginGuest(deviceId, displayName)
        return response
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async isGuest(userId?: string): Promise<boolean> {
    if (this.guestManager) {
      try {
        return await this.guestManager.isGuest(userId)
      } catch (_err) {
        return false
      }
    }
    return false
  }

  getGuestInfo(): GuestInfo | null {
    if (this.guestManager) {
      const info = this.guestManager.getGuestInfo()
      return info ? { ...info } : null
    }
    return null
  }

  async getGuestInfoFromServer(): Promise<ServerGuestInfo | null> {
    if (this.guestManager) {
      try {
        return await this.guestManager.getGuestInfoFromServer()
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async upgradeGuestAccount(request: UpgradeGuestRequest): Promise<{ userId: string } | null> {
    if (this.guestManager) {
      try {
        const response = await this.guestManager.upgradeGuestAccountOnServer(request)
        return { userId: response.user_id }
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async joinRoomAsGuest(roomIdOrAlias: string): Promise<string | null> {
    if (this.guestManager) {
      try {
        const result = await this.guestManager.joinRoomAsGuest(roomIdOrAlias)
        return result.roomId
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async canJoinRoom(roomIdOrAlias: string): Promise<boolean> {
    if (this.guestManager) {
      try {
        return await this.guestManager.canJoinRoom(roomIdOrAlias)
      } catch (_err) {
        return false
      }
    }
    return false
  }

  async getGuestRooms(): Promise<string[]> {
    if (this.guestManager) {
      try {
        return await this.guestManager.getGuestRooms()
      } catch (_err) {
        return []
      }
    }
    return []
  }

  isGuestTokenValid(): boolean {
    if (this.guestManager) {
      return this.guestManager.isGuestTokenValid()
    }
    return false
  }

  clearGuestInfo(): void {
    if (this.guestManager) {
      this.guestManager.clearGuestInfo()
    }
  }
}

export const matrixGuestService = new MatrixGuestService()
export default matrixGuestService
