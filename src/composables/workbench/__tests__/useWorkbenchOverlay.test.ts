import { describe, expect, it, vi } from 'vitest'
import { useWorkbenchOverlay } from '../useWorkbenchOverlay'

describe('useWorkbenchOverlay', () => {
  it('resets overlay state when closing or forwarding', () => {
    const api = useWorkbenchOverlay()
    api.overlayState.mode = 'forward'
    api.overlayState.forwardEventId = '$event'
    api.overlayState.forwardRoomId = '!room:server'
    api.overlayState.historyRoomId = '!history:server'
    api.overlayState.mergedMsgIds = ['$a', '$b']

    api.handleOverlayForwarded(['!room:server'])

    expect(api.overlayState).toMatchObject({
      mode: null,
      forwardEventId: '',
      forwardRoomId: '',
      historyRoomId: '',
      mergedMsgIds: []
    })
  })

  it('invokes session selection callbacks before closing the overlay', async () => {
    const onSessionSelected = vi.fn()
    const api = useWorkbenchOverlay({ onSessionSelected })
    api.overlayState.mode = 'search'

    await api.handleOverlayMessageSelected('!room:server', '$event')
    expect(onSessionSelected).toHaveBeenCalledWith('!room:server')
    expect(api.overlayState.mode).toBeNull()

    api.overlayState.mode = 'history'
    await api.handleOverlayRoomSelected('!another:server')
    expect(onSessionSelected).toHaveBeenCalledWith('!another:server')
    expect(api.overlayState.mode).toBeNull()
  })

  it('runs the created callback before resetting overlay state', async () => {
    const onCreated = vi.fn().mockResolvedValue(undefined)
    const api = useWorkbenchOverlay({ onCreated })
    api.overlayState.mode = 'create-room'

    await api.handleOverlayCreated({ roomId: '!new:server', space: { spaceId: '!space:server' } })

    expect(onCreated).toHaveBeenCalledWith({ roomId: '!new:server', space: { spaceId: '!space:server' } })
    expect(api.overlayState.mode).toBeNull()
  })
})
