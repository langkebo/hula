// src/services/mobile/__tests__/MobilePushRelayService.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobilePushRelayService } from '../MobilePushRelayService'

describe('MobilePushRelayService', () => {
  let service: MobilePushRelayService

  beforeEach(() => {
    service = new MobilePushRelayService()
  })

  it('registers a push callback and invokes it on dispatch', () => {
    const handler = vi.fn()
    service.onPushReceived(handler)

    service.dispatchTestPush({ id: 'p1', title: 'Test', body: 'Test body' })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Test', body: 'Test body' }))
  })

  it('startRelay sets active to true and stopRelay sets it to false', () => {
    expect(service.isActive()).toBe(false)

    service.startRelay()
    expect(service.isActive()).toBe(true)

    service.stopRelay()
    expect(service.isActive()).toBe(false)
  })

  it('startRelay and stopRelay toggle isActive state', () => {
    expect(service.isActive()).toBe(false)

    service.startRelay()
    expect(service.isActive()).toBe(true)

    service.stopRelay()
    expect(service.isActive()).toBe(false)

    service.startRelay()
    expect(service.isActive()).toBe(true)
  })

  it('supports multiple handlers and removal via unsubscribe', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    const remove1 = service.onPushReceived(h1)
    service.onPushReceived(h2)

    service.dispatchTestPush({ id: '1', title: 'T', body: 'B' })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)

    remove1()
    service.dispatchTestPush({ id: '2', title: 'T2', body: 'B2' })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(2)
  })
})
