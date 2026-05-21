import type { Room, RoomMember } from 'matrix-js-sdk'
import { matrixRoomQueryService } from './QueryService'

export interface MatrixRoomQueryFacade {
  getRooms(): Promise<Room[]>
  getRoom(roomId: string): Promise<Room>
  getRoom(roomId: string, throwOnError: true): Promise<Room>
  getRoom(roomId: string, throwOnError: false): Promise<Room | null>
  getMembers(roomId: string): Promise<RoomMember[]>
}

async function getRooms(): Promise<Room[]> {
  return matrixRoomQueryService.getRooms()
}

async function getRoom(roomId: string): Promise<Room>
async function getRoom(roomId: string, throwOnError: true): Promise<Room>
async function getRoom(roomId: string, throwOnError: false): Promise<Room | null>
async function getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
  if (throwOnError) {
    return matrixRoomQueryService.getRoom(roomId, true)
  }

  return matrixRoomQueryService.getRoom(roomId, false)
}

async function getMembers(roomId: string): Promise<RoomMember[]> {
  return matrixRoomQueryService.getMembers(roomId)
}

export const matrixRoomQueryFacade: MatrixRoomQueryFacade = {
  getRooms,
  getRoom,
  getMembers
}
