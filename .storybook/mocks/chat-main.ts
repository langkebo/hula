import { reactive } from 'vue'

const defaultState = () => ({
  selectKey: 'chat',
  optionsList: [],
  report: []
})

export const chatMainMock = reactive(defaultState())

export const resetChatMainMock = () => {
  Object.assign(chatMainMock, defaultState())
}

export const configureChatMainMock = (options: Partial<ReturnType<typeof defaultState>>) => {
  const newState = { ...defaultState(), ...options }
  Object.assign(chatMainMock, newState)
}

export const useChatMain = () => chatMainMock
