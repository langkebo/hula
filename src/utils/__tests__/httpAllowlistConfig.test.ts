import { describe, expect, it } from 'vitest'
import { resolveAllowlistConfig } from '@/utils/httpAllowlistConfig'

describe('resolveAllowlistConfig', () => {
  it('uses the built-in prod default set when raw is empty', () => {
    const hosts = resolveAllowlistConfig({ env: 'prod' }).rules.map((r) => r.host)
    expect(hosts).toContain('gitee.com')
    expect(hosts).toContain('api.siliconflow.cn')
    expect(hosts).toContain('translate.googleapis.com')
    expect(hosts).not.toContain('localhost')
  })

  it('includes loopback hosts in the dev default set', () => {
    const hosts = resolveAllowlistConfig({ env: 'dev' }).rules.map((r) => r.host)
    expect(hosts).toContain('localhost')
    expect(hosts).toContain('127.0.0.1')
  })

  it('lets an explicit raw config override the built-in default', () => {
    const hosts = resolveAllowlistConfig({ raw: 'https://custom.test', env: 'prod' }).rules.map((r) => r.host)
    expect(hosts).toEqual(['custom.test'])
  })

  it('appends the homeserver host derived from VITE_HOMESERVER_URL', () => {
    const hosts = resolveAllowlistConfig({ env: 'prod', homeserverUrl: 'https://hs.example.com:8448' }).rules.map(
      (r) => r.host
    )
    expect(hosts).toContain('hs.example.com')
  })

  it('defaults mode to report and only honors the exact enforce value', () => {
    expect(resolveAllowlistConfig({ env: 'prod' }).mode).toBe('report')
    expect(resolveAllowlistConfig({ env: 'prod', mode: 'enforce' }).mode).toBe('enforce')
    expect(resolveAllowlistConfig({ env: 'prod', mode: 'nonsense' }).mode).toBe('report')
  })
})
