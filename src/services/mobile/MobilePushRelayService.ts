// src/services/mobile/MobilePushRelayService.ts
interface PushPayload {
  id: string
  title: string
  body: string
  timestamp?: number
  data?: Record<string, unknown>
}

type PushHandler = (payload: PushPayload) => void
type Unsubscribe = () => void

export class MobilePushRelayService {
  private active = false
  private handlers = new Set<PushHandler>()

  startRelay(): void {
    this.active = true
  }

  stopRelay(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  onPushReceived(handler: PushHandler): Unsubscribe {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  dispatchTestPush(payload: PushPayload): void {
    if (!this.active) return
    for (const handler of this.handlers) {
      handler(payload)
    }
  }
}
