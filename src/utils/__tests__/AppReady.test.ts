import { afterEach, describe, expect, it } from 'vitest'
import { getTjgAppReadyPhase, isTjgAppReady, markTjgAppReady, resetTjgAppReadyForTests } from '../AppReady'

describe('AppReady', () => {
  afterEach(() => {
    resetTjgAppReadyForTests()
  })

  it('tracks boot phase as not ready by default', () => {
    expect(getTjgAppReadyPhase()).toBe('booting')
    expect(isTjgAppReady()).toBe(false)
  })

  it('marks mounted phase without reporting router readiness', () => {
    expect(markTjgAppReady('mounted')).toBe('mounted')
    expect(getTjgAppReadyPhase()).toBe('mounted')
    expect(isTjgAppReady()).toBe(false)
    expect(window.__TJG_APP_READY__).toBe(false)
  })

  it('marks router-ready phase and exposes readiness on window', () => {
    expect(markTjgAppReady('router-ready')).toBe('router-ready')
    expect(getTjgAppReadyPhase()).toBe('router-ready')
    expect(isTjgAppReady()).toBe(true)
    expect(window.__TJG_APP_READY__).toBe(true)
    expect(window.__TJG_APP_READY_PHASE__).toBe('router-ready')
  })
})
