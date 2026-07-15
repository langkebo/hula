import { describe, expect, it } from 'vitest'
import type { MatrixClientConfig } from '../MatrixClientService'
import { MatrixSyncManager } from '../MatrixSyncManager'

describe('MatrixSyncManager', () => {
  const createMockClient = () => ({}) as unknown as import('matrix-js-sdk').MatrixClient

  const defaultConfig: MatrixClientConfig = {
    homeserverUrl: 'https://matrix.test'
  }

  it('returns null when no instance has been created', () => {
    const manager = new MatrixSyncManager()
    expect(manager.get()).toBeNull()
  })

  it('creates a SlidingSync instance with default config values', () => {
    const manager = new MatrixSyncManager()
    const client = createMockClient()
    const ss = manager.create(client, defaultConfig)

    expect(ss).toBeDefined()
    expect(manager.get()).toBe(ss)
  })

  it('respects custom sliding sync config', () => {
    const manager = new MatrixSyncManager()
    const client = createMockClient()
    const ss = manager.create(client, {
      homeserverUrl: 'https://matrix.test',
      slidingSync: {
        roomRangeEnd: 9,
        timelineLimit: 5,
        pollTimeout: 15000
      }
    })

    expect(ss).toBeDefined()
    expect(manager.get()).toBe(ss)
  })

  it('stop clears the current instance', () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    expect(manager.get()).not.toBeNull()

    manager.stop()
    expect(manager.get()).toBeNull()
  })

  it('waitForReady returns false when no instance exists', async () => {
    const manager = new MatrixSyncManager()
    const ready = await manager.waitForReady(100)
    expect(ready).toBe(false)
  })

  it('waitForReady returns true after markReady is called', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()
    manager.markReady()

    const ready = await manager.waitForReady(500)
    expect(ready).toBe(true)
  })

  it('waitForReady times out when markReady is never called', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()

    const ready = await manager.waitForReady(50)
    expect(ready).toBe(false)
  })

  it('resetReady replaces the pending promise', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()
    manager.markReady()

    // First resetReady was already resolved by markReady
    const first = await manager.waitForReady(50)
    expect(first).toBe(true)

    // Second resetReady creates a new unresolved promise
    manager.resetReady()
    const second = await manager.waitForReady(50)
    expect(second).toBe(false)
  })
})
