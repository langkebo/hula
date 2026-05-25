import { afterEach, describe, expect, it } from 'vitest'
import { getHulaAppReadyPhase, isHulaAppReady, markHulaAppReady, resetHulaAppReadyForTests } from '../AppReady'

describe('AppReady', () => {
  afterEach(() => {
    resetHulaAppReadyForTests()
  })

  it('tracks boot phase as not ready by default', () => {
    expect(getHulaAppReadyPhase()).toBe('booting')
    expect(isHulaAppReady()).toBe(false)
  })

  it('marks mounted phase without reporting router readiness', () => {
    expect(markHulaAppReady('mounted')).toBe('mounted')
    expect(getHulaAppReadyPhase()).toBe('mounted')
    expect(isHulaAppReady()).toBe(false)
    expect(window.__HULA_APP_READY__).toBe(false)
  })

  it('marks router-ready phase and exposes readiness on window', () => {
    expect(markHulaAppReady('router-ready')).toBe('router-ready')
    expect(getHulaAppReadyPhase()).toBe('router-ready')
    expect(isHulaAppReady()).toBe(true)
    expect(window.__HULA_APP_READY__).toBe(true)
    expect(window.__HULA_APP_READY_PHASE__).toBe('router-ready')
  })
})
