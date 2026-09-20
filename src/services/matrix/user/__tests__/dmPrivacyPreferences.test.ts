import { beforeEach, describe, expect, it } from 'vitest'
import {
  cacheDmPrivacyPreferences,
  DEFAULT_DM_PRIVACY_PREFERENCES,
  DM_PRIVACY_PREFERENCES_STORAGE_KEY,
  type DmPrivacyPreferences,
  loadDmPrivacyPreferences,
  normalizeDmPrivacyPreferences,
  resolveDmEncryption
} from '../dmPrivacyPreferences'

function prefs(overrides: Partial<DmPrivacyPreferences> = {}): DmPrivacyPreferences {
  return { ...DEFAULT_DM_PRIVACY_PREFERENCES, ...overrides }
}

describe('resolveDmEncryption', () => {
  it('encrypts by default preference', () => {
    expect(resolveDmEncryption(undefined, prefs({ encryptByDefault: true }))).toBe(true)
  })

  it('does not encrypt when the preference is off', () => {
    expect(resolveDmEncryption(undefined, prefs({ encryptByDefault: false }))).toBe(false)
  })

  it('lets an explicit request override the preference in both directions', () => {
    expect(resolveDmEncryption(true, prefs({ encryptByDefault: false }))).toBe(true)
    expect(resolveDmEncryption(false, prefs({ encryptByDefault: true }))).toBe(false)
  })

  it('falls back to the preference for junk input', () => {
    expect(resolveDmEncryption('yes' as never, prefs({ encryptByDefault: true }))).toBe(true)
    expect(resolveDmEncryption(null as never, prefs({ encryptByDefault: false }))).toBe(false)
  })

  it('accepts an approval-style prefs source', () => {
    expect(resolveDmEncryption(undefined, { encryptByDefault: true })).toBe(true)
  })

  it('is safe when preferences are malformed', () => {
    // 缺失/损坏时退回默认：默认是加密，安全方向
    expect(resolveDmEncryption(undefined, null as never)).toBe(DEFAULT_DM_PRIVACY_PREFERENCES.encryptByDefault)
    expect(resolveDmEncryption(undefined, {} as never)).toBe(DEFAULT_DM_PRIVACY_PREFERENCES.encryptByDefault)
  })
})

describe('normalizeDmPrivacyPreferences', () => {
  it('falls back to defaults for junk', () => {
    expect(normalizeDmPrivacyPreferences(null)).toEqual(DEFAULT_DM_PRIVACY_PREFERENCES)
    expect(normalizeDmPrivacyPreferences('nope')).toEqual(DEFAULT_DM_PRIVACY_PREFERENCES)
  })

  it('keeps a valid boolean', () => {
    expect(normalizeDmPrivacyPreferences({ encryptByDefault: false }).encryptByDefault).toBe(false)
  })

  it('replaces non-boolean values with the default', () => {
    expect(normalizeDmPrivacyPreferences({ encryptByDefault: 'yes' }).encryptByDefault).toBe(
      DEFAULT_DM_PRIVACY_PREFERENCES.encryptByDefault
    )
  })

  it('defaults to encrypting new DMs', () => {
    // 安全方向：默认开启，避免新用户默认建出明文私聊
    expect(DEFAULT_DM_PRIVACY_PREFERENCES.encryptByDefault).toBe(true)
  })
})

describe('load / cache round trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is cached', () => {
    expect(loadDmPrivacyPreferences()).toEqual(DEFAULT_DM_PRIVACY_PREFERENCES)
  })

  it('round-trips preferences', () => {
    const p = prefs({ encryptByDefault: false })
    cacheDmPrivacyPreferences(p)
    expect(loadDmPrivacyPreferences()).toEqual(p)
  })

  it('writes under the documented key', () => {
    cacheDmPrivacyPreferences(prefs())
    expect(localStorage.getItem(DM_PRIVACY_PREFERENCES_STORAGE_KEY)).toBeTruthy()
  })

  it('recovers from corrupt JSON', () => {
    localStorage.setItem(DM_PRIVACY_PREFERENCES_STORAGE_KEY, '{broken')
    expect(loadDmPrivacyPreferences()).toEqual(DEFAULT_DM_PRIVACY_PREFERENCES)
  })

  it('tolerates storage that throws', () => {
    const throwingRead = {
      getItem: () => {
        throw new Error('blocked')
      }
    } as unknown as Pick<Storage, 'getItem'>
    const throwingWrite = {
      setItem: () => {
        throw new Error('quota')
      }
    } as unknown as Pick<Storage, 'setItem'>
    expect(loadDmPrivacyPreferences(throwingRead)).toEqual(DEFAULT_DM_PRIVACY_PREFERENCES)
    expect(() => cacheDmPrivacyPreferences(prefs(), throwingWrite)).not.toThrow()
  })

  it('reads preferences through to resolveDmEncryption', () => {
    cacheDmPrivacyPreferences(prefs({ encryptByDefault: false }))
    expect(resolveDmEncryption(undefined, loadDmPrivacyPreferences())).toBe(false)
  })
})
