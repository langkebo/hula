import { describe, expect, it } from 'vitest'
import {
  createEmptyProxySettings,
  hasActiveProxySettings,
  migrateLegacyProxySettings,
  parseStoredProxySettings
} from '../proxySettings'

describe('proxySettings', () => {
  it('migrates legacy local 28008 proxy settings when default homeserver is remote', () => {
    const migrated = migrateLegacyProxySettings(
      {
        apiType: 'http',
        apiIp: 'localhost',
        apiPort: '28008',
        apiSuffix: '',
        wsType: 'ws',
        wsIp: '127.0.0.1',
        wsPort: '28008',
        wsSuffix: '/ws/ws'
      },
      'https://matrix.test'
    )

    expect(migrated).toEqual(createEmptyProxySettings())
    expect(hasActiveProxySettings(migrated)).toBe(false)
  })

  it('keeps proxy settings when default homeserver remains local', () => {
    const settings = {
      apiType: 'http',
      apiIp: 'localhost',
      apiPort: '28008',
      apiSuffix: '',
      wsType: '',
      wsIp: '',
      wsPort: '',
      wsSuffix: ''
    }

    expect(migrateLegacyProxySettings(settings, 'http://localhost:8008')).toEqual(settings)
  })

  it('parses and removes inactive migrated proxy settings', () => {
    const parsed = parseStoredProxySettings(
      JSON.stringify({
        apiType: 'http',
        apiIp: 'localhost',
        apiPort: '28008',
        apiSuffix: ''
      }),
      'https://matrix.test'
    )

    expect(parsed).toBeNull()
  })
})
