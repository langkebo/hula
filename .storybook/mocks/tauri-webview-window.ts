import { reactive } from 'vue'

type Listener = (event: { payload?: unknown }) => void | Promise<void>

const createUnlisten = () => {}

export class PhysicalPosition {
  x: number
  y: number

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
}

export const UserAttentionType = {
  Critical: 'critical',
  Informational: 'informational'
} as const

export const currentMonitor = () => null
export const primaryMonitor = () => null

const defaultState = {
  getCurrent() {
    return {
      listen: async (_event: string, _handler: Listener) => createUnlisten,
    }
  },
}

export const webviewWindowMock = reactive(defaultState)

export function resetWebviewWindowMock() {
  webviewWindowMock.getCurrent = defaultState.getCurrent
}

export function configureWebviewWindowMock(options: Partial<typeof defaultState>) {
  resetWebviewWindowMock()
  if (options.getCurrent) {
    webviewWindowMock.getCurrent = options.getCurrent
  }
}

export const getCurrentWindow = () => WebviewWindow.getCurrent()
export const WebviewWindow = webviewWindowMock
