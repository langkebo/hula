import { describe, expect, it } from 'vitest'
import { MatrixClientTelemetry } from '../MatrixClientTelemetry'

/** 在原型链上定义 getter 的模拟 client */
class MockClient {
  getFriendManager() {
    return { getRequestStats: () => ({ total: 1, successful: 1, failed: 0, retried: 0 }) }
  }
  getRoomManager() {
    return { getRequestStats: () => ({ total: 2, successful: 2, failed: 0, retried: 0 }) }
  }
  getNoStatsManager() {
    return {}
  }
  getSomeOther() {
    return {}
  }
}

/** getter 抛错的 client */
class ThrowingClient extends MockClient {
  override getRoomManager(): never {
    throw new Error('boom')
  }
}

function makeService(client: unknown): MatrixClientTelemetry {
  const deps = { connectionManager: { getClient: () => client } } as unknown as MatrixClientTelemetry['deps']
  return new MatrixClientTelemetry(deps)
}

describe('MatrixClientTelemetry', () => {
  it('setTelemetryManager/getTelemetry roundtrip', () => {
    const svc = makeService(null)
    expect(svc.getTelemetry()).toBeNull()
    const mgr = { name: 'x' } as unknown as Parameters<MatrixClientTelemetry['setTelemetryManager']>[0]
    svc.setTelemetryManager(mgr)
    expect(svc.getTelemetry()).toBe(mgr)
  })

  it('returns empty array when no client', () => {
    const svc = makeService(null)
    expect(svc.getManagerStatsList()).toEqual([])
  })

  it('collects manager stats and converts getter names to metric names', () => {
    const svc = makeService(new MockClient())
    const stats = svc.getManagerStatsList()

    expect(stats).toHaveLength(2)
    expect(stats).toEqual(
      expect.arrayContaining([
        { name: 'friend', stats: { total: 1, successful: 1, failed: 0, retried: 0 } },
        { name: 'room', stats: { total: 2, successful: 2, failed: 0, retried: 0 } }
      ])
    )
  })

  it('skips getters without getRequestStats', () => {
    const svc = makeService(new MockClient())
    const names = svc.getManagerStatsList().map((s) => s.name)
    expect(names).not.toContain('noStats')
  })

  it('skips getters that throw', () => {
    const svc = makeService(new ThrowingClient())
    const names = svc.getManagerStatsList().map((s) => s.name)
    expect(names).toContain('friend')
    expect(names).not.toContain('room')
  })
})
