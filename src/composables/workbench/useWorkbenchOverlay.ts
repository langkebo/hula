export type WorkbenchOverlayMode = 'create-room' | 'create-space' | 'forward' | 'search' | 'history' | 'merged-msg'

export interface WorkbenchOverlayState<OverlayMode extends string = WorkbenchOverlayMode> {
  mode: OverlayMode | null
  forwardEventId: string
  forwardRoomId: string
  historyRoomId: string
  mergedMsgIds: string[]
}

interface UseWorkbenchOverlayOptions {
  onSessionSelected?: (roomId: string) => void | Promise<void>
  onCreated?: (data: { roomId?: string; space?: unknown }) => void | Promise<void>
}

export const useWorkbenchOverlay = <OverlayMode extends string = WorkbenchOverlayMode>(
  options: UseWorkbenchOverlayOptions = {}
) => {
  const overlayState = reactive<WorkbenchOverlayState<OverlayMode>>({
    mode: null,
    forwardEventId: '',
    forwardRoomId: '',
    historyRoomId: '',
    mergedMsgIds: []
  })

  const closeOverlay = () => {
    overlayState.mode = null
    overlayState.forwardEventId = ''
    overlayState.forwardRoomId = ''
    overlayState.historyRoomId = ''
    overlayState.mergedMsgIds = []
  }

  const handleOverlayCreated = async (data: { roomId?: string; space?: unknown }) => {
    await options.onCreated?.(data)
    closeOverlay()
  }

  const handleOverlayForwarded = (_roomIds: string[]) => {
    closeOverlay()
  }

  const handleOverlayMessageSelected = async (roomId: string, _eventId: string) => {
    await options.onSessionSelected?.(roomId)
    closeOverlay()
  }

  const handleOverlayRoomSelected = async (roomId: string) => {
    await options.onSessionSelected?.(roomId)
    closeOverlay()
  }

  const handleOverlayUserSelected = (_userId: string) => {
    closeOverlay()
  }

  return {
    overlayState,
    closeOverlay,
    handleOverlayCreated,
    handleOverlayForwarded,
    handleOverlayMessageSelected,
    handleOverlayRoomSelected,
    handleOverlayUserSelected
  }
}
