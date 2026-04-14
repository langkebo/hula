/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
export interface BeaconInfo {
  event_id: string
  room_id: string
  user_id: string
  description?: string
  timeout?: number
  is_live: boolean
  last_updated: number
}

export interface BeaconLocation {
  event_id: string
  beacon_info_id: string
  timestamp: number
  latitude: number
  longitude: number
  uncertainty?: number
  altitude?: number
  speed?: number
  bearing?: number
}

export interface CreateBeaconParams {
  roomId: string
  description?: string
  timeout?: number
}

export interface UpdateBeaconLocationParams {
  roomId: string
  beaconInfoEventId: string
  latitude: number
  longitude: number
  uncertainty?: number
  altitude?: number
  speed?: number
  bearing?: number
}

class MatrixBeaconService extends BaseManager {
  private beaconManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.beaconManager = (client as any).getBeaconManager?.() ?? null
      if (this.beaconManager) {
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_err) {}
  }

  private get client() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    return client
  }

  async createBeacon(params: CreateBeaconParams): Promise<BeaconInfo> {
    const { roomId, description, timeout = 3600000 } = params

    if (this.beaconManager) {
      const beaconInfoContent = {
        description,
        timeout,
        live: true,
        'org.matrix.msc3488.asset': {
          type: 'm.self'
        },
        'org.matrix.msc3488.ts': Date.now()
      }

      await this.beaconManager.createLiveBeacon(roomId, beaconInfoContent)

      const beacons = this.beaconManager.getBeaconsForRoom(roomId)
      const beacon = beacons?.[beacons.length - 1]

      if (!beacon) {
        throw new Error('Failed to create beacon via BeaconManager')
      }

      const beaconEvent = beacon.beaconInfo
      return {
        event_id: beaconEvent.getId() ?? '',
        room_id: roomId,
        user_id: beaconEvent.getSender() ?? '',
        description: beaconEvent.getContent()?.description,
        timeout: beaconEvent.getContent()?.timeout,
        is_live: beacon.isLive,
        last_updated: beaconEvent.getTs() ?? Date.now()
      }
    }

    const content = {
      description,
      timeout,
      live: true,
      'org.matrix.msc3488.asset': {
        type: 'm.self'
      },
      'org.matrix.msc3488.ts': Date.now()
    }

    const event: any = await this.client.sendStateEvent(roomId, 'm.beacon_info', content, this.client.getUserId()!)
    if (!event) {
      throw new Error('Failed to send beacon state event')
    }

    const userId = this.client.getUserId() as string
    return {
      event_id: event.event_id ?? '',
      room_id: roomId,
      user_id: userId,
      description,
      timeout,
      is_live: true,
      last_updated: Date.now()
    }
  }

  async getBeaconInfo(roomId: string, eventId: string): Promise<BeaconInfo | null> {
    if (this.beaconManager) {
      const beacon = this.beaconManager.getBeacon(roomId, eventId)
      if (!beacon) return null

      const beaconEvent = beacon.beaconInfo
      return {
        event_id: beaconEvent.getId() ?? eventId,
        room_id: roomId,
        user_id: beaconEvent.getSender() ?? '',
        description: beaconEvent.getContent()?.description,
        timeout: beaconEvent.getContent()?.timeout,
        is_live: beacon.isLive,
        last_updated: beaconEvent.getTs() ?? Date.now()
      }
    }

    try {
      const event = await this.client.getRoomEvent(roomId, eventId)
      const content: any = event.getContent()
      if (!content) return null

      return {
        event_id: eventId,
        room_id: roomId,
        user_id: event.sender?.userId || '',
        description: content.description,
        timeout: content.timeout,
        is_live: content.live,
        last_updated: event.originServerTs || Date.now()
      }
    } catch {
      return null
    }
  }

  async getActiveBeacons(roomId: string): Promise<BeaconInfo[]> {
    if (this.beaconManager) {
      const beacons = this.beaconManager.getBeaconsForRoom(roomId) ?? []
      return beacons
        .filter((b: any) => b.isLive)
        .map((beacon: any) => {
          const beaconEvent = beacon.beaconInfo
          return {
            event_id: beaconEvent.getId() ?? '',
            room_id: roomId,
            user_id: beaconEvent.getSender() ?? '',
            description: beaconEvent.getContent()?.description,
            timeout: beaconEvent.getContent()?.timeout,
            is_live: true,
            last_updated: beaconEvent.getTs() ?? Date.now()
          }
        })
    }

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return []

      const stateEvents = room.currentState.getStateEvents('m.beacon_info')
      const beacons: BeaconInfo[] = []

      for (const event of stateEvents) {
        const content = event.getContent() as any
        if (content?.live) {
          beacons.push({
            event_id: event.getId() ?? '',
            room_id: roomId,
            user_id: event.getSender() ?? '',
            description: content.description as string | undefined,
            timeout: content.timeout as number | undefined,
            is_live: true,
            last_updated: event.getTs() ?? Date.now()
          })
        }
      }

      return beacons
    } catch {
      return []
    }
  }

  async updateBeaconLocation(params: UpdateBeaconLocationParams): Promise<BeaconLocation> {
    const { roomId, beaconInfoEventId, latitude, longitude, uncertainty, altitude, speed, bearing } = params

    if (this.beaconManager) {
      const beacon = this.beaconManager.getBeacon(roomId, beaconInfoEventId)
      if (beacon) {
        const geoUri = `geo:${latitude},${longitude}${uncertainty ? `;u=${uncertainty}` : ''}`
        await beacon.updateLocation(geoUri, Date.now(), uncertainty, altitude, speed, bearing)

        return {
          event_id: '',
          beacon_info_id: beaconInfoEventId,
          timestamp: Date.now(),
          latitude,
          longitude,
          uncertainty,
          altitude,
          speed,
          bearing
        }
      }
    }

    const content = {
      'm.beacon': {
        event_id: beaconInfoEventId,
        timestamp: Date.now(),
        location: {
          uri: `geo:${latitude},${longitude}`,
          timestamp: Date.now(),
          accuracy: uncertainty,
          altitude,
          speed,
          bearing,
          description: ''
        }
      },
      'org.matrix.msc3488.ts': Date.now()
    }

    const event = await this.client.sendEvent(roomId, 'm.beacon', content)

    return {
      event_id: event.event_id,
      beacon_info_id: beaconInfoEventId,
      timestamp: Date.now(),
      latitude,
      longitude,
      uncertainty,
      altitude,
      speed,
      bearing
    }
  }

  async getBeaconLocationHistory(
    roomId: string,
    beaconInfoEventId: string,
    _limit: number = 50
  ): Promise<BeaconLocation[]> {
    if (this.beaconManager) {
      const beacon = this.beaconManager.getBeacon(roomId, beaconInfoEventId)
      if (!beacon) return []

      const locations = beacon.getLocations?.() ?? []
      const result = locations
        .map((loc: any) => {
          const geoUri = loc.uri || loc.geoUri || ''
          const geoMatch = geoUri.match(/geo:([-\d.]+),([-\d.]+)/)
          if (!geoMatch) return null

          return {
            event_id: loc.eventId ?? '',
            beacon_info_id: beaconInfoEventId,
            timestamp: loc.timestamp ?? Date.now(),
            latitude: parseFloat(geoMatch[1]),
            longitude: parseFloat(geoMatch[2]),
            uncertainty: loc.accuracy ?? loc.uncertainty,
            altitude: loc.altitude,
            speed: loc.speed,
            bearing: loc.bearing
          }
        })
        .filter(Boolean) as BeaconLocation[]

      return result.sort((a, b) => a.timestamp - b.timestamp)
    }

    try {
      const room = this.client.getRoom(roomId)
      if (!room) return []

      const timeline = room.getLiveTimeline().getEvents()
      const locations: BeaconLocation[] = []

      for (const event of timeline) {
        if (event.getType() !== 'm.beacon') continue
        const content = event.getContent() as any
        const beaconData = content?.['m.beacon'] || content?.beacon
        if (!beaconData?.location) continue

        const geo = beaconData.location as any
        const geoMatch = geo.uri?.match(/geo:([-\d.]+),([-\d.]+)/)
        if (!geoMatch) continue

        const beaconInfoId = beaconData.event_id
        if (beaconInfoId !== beaconInfoEventId) continue

        locations.push({
          event_id: event.getId() ?? '',
          beacon_info_id: beaconInfoEventId,
          timestamp: geo.timestamp || event.getTs() || Date.now(),
          latitude: parseFloat(geoMatch[1]),
          longitude: parseFloat(geoMatch[2]),
          uncertainty: geo.accuracy,
          altitude: geo.altitude,
          speed: geo.speed,
          bearing: geo.bearing
        })
      }

      return locations.sort((a, b) => a.timestamp - b.timestamp)
    } catch {
      return []
    }
  }

  async stopBeacon(roomId: string, eventId: string): Promise<boolean> {
    if (this.beaconManager) {
      try {
        await this.beaconManager.stopBeacon(roomId, eventId)
        return true
      } catch (_err) {
        return false
      }
    }

    try {
      const stateKey = this.client.getUserId()!
      const currentContent = await this.client.getStateEvent(roomId, 'm.beacon_info', stateKey)
      if (!currentContent) return false

      currentContent.live = false
      await this.client.sendStateEvent(roomId, 'm.beacon_info', currentContent, stateKey)
      return true
    } catch (_err) {
      return false
    }
  }

  async deleteBeacon(roomId: string, eventId: string): Promise<boolean> {
    try {
      await this.client.redactEvent(roomId, eventId, undefined, { reason: 'Beacon deleted' })
      return true
    } catch (_err) {
      return false
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (this.beaconManager) {
      this.beaconManager.on(event, handler)
    }
  }

  off(event: string, handler: (...args: any[]) => void): void {
    if (this.beaconManager) {
      this.beaconManager.off(event, handler)
    }
  }
}

export const matrixBeaconService = new MatrixBeaconService()
