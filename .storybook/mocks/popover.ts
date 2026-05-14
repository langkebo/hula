import { reactive } from 'vue'

const defaultState = {
  handlePopoverUpdate: () => true,
  enableScroll: () => {},
}

export const popoverMock = reactive(defaultState)

export function resetPopoverMock() {
  Object.assign(popoverMock, defaultState)
}

export function configurePopoverMock(options: Partial<typeof defaultState>) {
  Object.assign(popoverMock, { ...defaultState, ...options })
}

export const usePopover = () => popoverMock
