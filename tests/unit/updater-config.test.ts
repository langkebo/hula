/**
 * Task 5: updater tauriKey 外置 — 纯函数注入逻辑单元测试。
 *
 * 验证 `scripts/updater-config.js` 的 `buildUpdaterConfigOverride`：
 * 1. 无 key（undefined / 空串 / 空白）时返回 null（跳过 --config 注入，不崩溃）。
 * 2. 有 key 时返回 `plugins.updater.endpoints` 完整数组，占位符被真实 key 替换。
 * 3. 第二个 gitee fallback 端点保持不变。
 */
import { describe, expect, it } from 'vitest'
import {
  buildCspConfigOverride,
  buildUpdaterConfigOverride,
  CSP_HOMESERVER_PATTERN,
  DEFAULT_HOMESERVER_URL,
  homeserverUrlToConnectSrc,
  replaceHomeserverInCsp,
  UPDATER_ENDPOINTS,
  UPDATER_KEY_PLACEHOLDER
} from '../../scripts/updater-config.js'

const KEY = 'test-tauri-key-not-real'

describe('buildUpdaterConfigOverride', () => {
  it('无 key 时返回 null（不注入 --config）', () => {
    expect(buildUpdaterConfigOverride(undefined)).toBeNull()
    expect(buildUpdaterConfigOverride('')).toBeNull()
    expect(buildUpdaterConfigOverride('   ')).toBeNull()
    expect(buildUpdaterConfigOverride(123 as unknown as string)).toBeNull()
  })

  it('有 key 时生成完整 endpoints 覆盖，占位符被替换', () => {
    const override = buildUpdaterConfigOverride(KEY)
    expect(override).not.toBeNull()
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(Array.isArray(endpoints)).toBe(true)
    expect(endpoints.length).toBe(UPDATER_ENDPOINTS.length)
    expect(endpoints[0]).toContain(`tauriKey=${KEY}`)
    expect(endpoints[0]).not.toContain(UPDATER_KEY_PLACEHOLDER)
  })

  it('第二个 gitee fallback 端点保持不变', () => {
    const override = buildUpdaterConfigOverride(KEY)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints[1]).toBe('https://gitee.com/llangkebo/hula/releases/download/latest/latest.json')
  })

  it('覆盖端点中不含任何残留占位符', () => {
    const override = buildUpdaterConfigOverride(KEY)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints.some((url) => url.includes(UPDATER_KEY_PLACEHOLDER))).toBe(false)
  })

  it('key 会被 trim', () => {
    const override = buildUpdaterConfigOverride(`  ${KEY}  `)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints[0]).toContain(`tauriKey=${KEY}`)
    expect(endpoints[0]).not.toContain('tauriKey=%20')
  })
})

describe('homeserverUrlToConnectSrc', () => {
  it('https homeserver 生成 https + wss 来源', () => {
    expect(homeserverUrlToConnectSrc('https://matrix.test')).toBe('https://matrix.test wss://matrix.test')
  })

  it('http homeserver 生成 http + ws 来源', () => {
    expect(homeserverUrlToConnectSrc('http://localhost:8008')).toBe(
      'http://localhost:8008 ws://localhost:8008'
    )
  })

  it('剥离路径与查询，保留 host（含端口）', () => {
    expect(homeserverUrlToConnectSrc('https://matrix.test/')).toBe('https://matrix.test wss://matrix.test')
    expect(homeserverUrlToConnectSrc('https://matrix.test/_matrix/client/v3')).toBe(
      'https://matrix.test wss://matrix.test'
    )
  })

  it('非法或非 http(s) 返回 null', () => {
    expect(homeserverUrlToConnectSrc(undefined)).toBeNull()
    expect(homeserverUrlToConnectSrc('')).toBeNull()
    expect(homeserverUrlToConnectSrc('not a url')).toBeNull()
    expect(homeserverUrlToConnectSrc('ftp://example.com')).toBeNull()
  })
})

describe('buildCspConfigOverride', () => {
  const desktopCsp =
    "default-src 'self'; connect-src 'self' ipc: tauri: https://asset.localhost https://matrix.test wss://matrix.test; img-src 'self'"

  it('未配置 homeserver 时返回 null（默认 https://matrix.test 无需注入）', () => {
    expect(buildCspConfigOverride(undefined, { csp: desktopCsp })).toBeNull()
    expect(buildCspConfigOverride('', { csp: desktopCsp })).toBeNull()
    expect(buildCspConfigOverride('https://matrix.test', { csp: desktopCsp })).toBeNull()
  })

  it('http://localhost:8008 覆盖为 http + ws，且不含 scheme 级通配', () => {
    const override = buildCspConfigOverride('http://localhost:8008', { csp: desktopCsp })
    expect(override).not.toBeNull()
    const csp = override?.app?.security?.csp as string
    expect(csp).toContain('http://localhost:8008 ws://localhost:8008')
    expect(csp).not.toContain(CSP_HOMESERVER_PATTERN)
    // 不引入 scheme 级通配：connect-src 内不得出现裸 https:/wss:/http:/ws: scheme source
    const connectSrc = csp.split('connect-src')[1]?.split(';')[0] ?? ''
    expect(connectSrc).not.toMatch(/(^|\s)https:(\s|$)/)
    expect(connectSrc).not.toMatch(/(^|\s)wss:(\s|$)/)
    expect(connectSrc).not.toMatch(/(^|\s)http:(\s|$)/)
    expect(connectSrc).not.toMatch(/(^|\s)ws:(\s|$)/)
  })

  it('https 覆盖替换占位并保留其余 csp 指令', () => {
    const override = buildCspConfigOverride('https://hs.example.com:8443', { csp: desktopCsp })
    const csp = override?.app?.security?.csp as string
    expect(csp).toContain('https://hs.example.com:8443 wss://hs.example.com:8443')
    expect(csp).toContain('https://asset.localhost')
    expect(csp).not.toContain('https://matrix.test wss://matrix.test')
  })

  it('同时注入 csp 与 devCsp', () => {
    const devCsp = "connect-src 'self' https://matrix.test wss://matrix.test http://localhost:6130"
    const override = buildCspConfigOverride('https://hs.example.com', {
      csp: desktopCsp,
      devCsp
    })
    expect(override?.app?.security?.csp).toContain('https://hs.example.com wss://hs.example.com')
    expect(override?.app?.security?.devCsp).toContain('https://hs.example.com wss://hs.example.com')
    expect(override?.app?.security?.devCsp).toContain('http://localhost:6130')
  })

  it('生成的覆盖对象是合法 JSON（可序列化）', () => {
    const override = buildCspConfigOverride('http://localhost:8008', { csp: desktopCsp })
    expect(() => JSON.parse(JSON.stringify(override))).not.toThrow()
    expect(DEFAULT_HOMESERVER_URL).toBe('https://matrix.test')
  })
})

describe('replaceHomeserverInCsp', () => {
  it('仅在命中占位时替换', () => {
    const csp = 'connect-src a https://matrix.test wss://matrix.test b'
    expect(replaceHomeserverInCsp(csp, 'http://localhost:8008')).toBe(
      'connect-src a http://localhost:8008 ws://localhost:8008 b'
    )
    expect(replaceHomeserverInCsp('connect-src a b', 'http://localhost:8008')).toBe('connect-src a b')
  })
})
