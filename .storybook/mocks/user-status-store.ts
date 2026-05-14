import { reactive } from 'vue'

type UserStatus = 'online' | 'offline' | 'away'

const defaultState = () => ({
  userStatus: 'online' as UserStatus,
  stateList: []
})

export const userStatusStoreMock = reactive(defaultState())

export const resetUserStatusStoreMock = () => {
  Object.assign(userStatusStoreMock, defaultState())
}

export const configureUserStatusStoreMock = (options: Partial<ReturnType<typeof defaultState>>) => {
  const newState = { ...defaultState(), ...options }
  Object.assign(userStatusStoreMock, newState)
}

export const useUserStatusStore = () => userStatusStoreMock
