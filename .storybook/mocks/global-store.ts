import { reactive } from 'vue'
import { RoomTypeEnum } from '@/enums'

const defaultState = () => ({
  currentSessionRoomId: '!storybook:example.com',
  isSidebarExpand: true,
  roomType: RoomTypeEnum.GROUP,
})

export const globalStoreMock = reactive(defaultState())

export const resetGlobalStoreMock = () => {
  Object.assign(globalStoreMock, defaultState())
}

export const configureGlobalStoreMock = (options: Partial<ReturnType<typeof defaultState>>) => {
  const newState = { ...defaultState(), ...options }
  Object.assign(globalStoreMock, newState)
}

export const useGlobalStore = () => globalStoreMock
