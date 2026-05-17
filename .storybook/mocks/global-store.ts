import { reactive } from 'vue'
import { RoomTypeEnum } from '@/enums'

const defaultState = () => ({
  currentSessionRoomId: '!storybook:example.com',
  isSidebarExpand: true,
  roomType: RoomTypeEnum.GROUP,
  currentSession: {
    type: RoomTypeEnum.GROUP,
    detailId: '@storybook:example.com'
  },
  openAddFriendModal: () => undefined,
  openAddGroupModal: () => undefined,
  closeAddFriendModal: () => undefined,
  closeAddGroupModal: () => undefined,
  updateCurrentSessionRoomId(roomId: string) {
    globalStoreMock.currentSessionRoomId = roomId
  }
})

export const globalStoreMock = reactive(defaultState())

export const resetGlobalStoreMock = () => {
  Object.assign(globalStoreMock, defaultState())
}

export const configureGlobalStoreMock = (options: Partial<ReturnType<typeof defaultState>>) => {
  const newState = { ...defaultState(), ...options }
  if (!options.currentSession) {
    newState.currentSession = {
      type: newState.roomType,
      detailId: '@storybook:example.com'
    }
  }
  Object.assign(globalStoreMock, newState)
}

export const useGlobalStore = () => globalStoreMock
