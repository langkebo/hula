import { reactive } from 'vue'

const defaultState = {
  async getUserByIds() {
    return []
  },
}

export const matrixContactServiceMock = reactive(defaultState)

export function resetContactServiceMock() {
  Object.assign(matrixContactServiceMock, defaultState)
}

export function configureContactServiceMock(options: Partial<typeof defaultState>) {
  Object.assign(matrixContactServiceMock, { ...defaultState, ...options })
}

export const matrixContactService = matrixContactServiceMock
