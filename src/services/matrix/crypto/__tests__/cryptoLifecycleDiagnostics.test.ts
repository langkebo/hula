import { describe, expect, it } from 'vitest'
import { CryptoLifecycleDiagnosticsTracker } from '../cryptoLifecycleDiagnostics'

/**
 * 这组诊断是 A1 缺陷（已停止的 crypto 被复用导致 E2EE 静默失效）的运行时哨兵，
 * 状态迁移的正确性直接决定能否在事故现场看到信号。
 */
describe('CryptoLifecycleDiagnosticsTracker', () => {
  it('starts with an empty snapshot', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    expect(tracker.snapshot()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
  })

  it('records a rejected binding release', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.rejectBindingRelease('crypto still running')

    expect(tracker.snapshot().lastBindingReleaseRejection).toBe('crypto still running')
    expect(tracker.snapshot().stoppedBindingReleased).toBe(0)
  })

  it('counts successful releases and clears the previous rejection', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.rejectBindingRelease('crypto still running')

    tracker.recordBindingReleased()
    tracker.recordBindingReleased()

    expect(tracker.snapshot()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 2,
      staleCryptoReuseWarning: null
    })
  })

  it('records stale crypto reuse without touching the release counters', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.recordBindingReleased()
    tracker.recordStaleCryptoReuse('startClient reused a stopped crypto binding')

    expect(tracker.snapshot()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 1,
      staleCryptoReuseWarning: 'startClient reused a stopped crypto binding'
    })
  })

  it('keeps the latest reason for repeated events', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.rejectBindingRelease('first')
    tracker.rejectBindingRelease('second')
    tracker.recordStaleCryptoReuse('first reuse')
    tracker.recordStaleCryptoReuse('second reuse')

    expect(tracker.snapshot().lastBindingReleaseRejection).toBe('second')
    expect(tracker.snapshot().staleCryptoReuseWarning).toBe('second reuse')
  })

  it('returns a copy so callers cannot mutate internal state', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.rejectBindingRelease('crypto still running')

    const snapshot = tracker.snapshot()
    snapshot.lastBindingReleaseRejection = 'mutated'
    snapshot.stoppedBindingReleased = 99

    expect(tracker.snapshot().lastBindingReleaseRejection).toBe('crypto still running')
    expect(tracker.snapshot().stoppedBindingReleased).toBe(0)
  })

  it('reset clears the diagnostics after logout / account switch', () => {
    const tracker = new CryptoLifecycleDiagnosticsTracker()
    tracker.rejectBindingRelease('crypto still running')
    tracker.recordBindingReleased()
    tracker.recordStaleCryptoReuse('reuse')

    tracker.reset()

    expect(tracker.snapshot()).toEqual({
      lastBindingReleaseRejection: null,
      stoppedBindingReleased: 0,
      staleCryptoReuseWarning: null
    })
  })
})
