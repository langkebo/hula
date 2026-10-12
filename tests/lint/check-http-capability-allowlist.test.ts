import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_FILES,
  collectSanctionedDevHomeserverHosts,
  coversHost,
  evaluateHttpCapabilityAllowlist,
  extractHttpAllowEntries,
  parseAllEnvHomeservers,
  parseEnvHomeserver,
  resolveHomeserver,
  splitHostPattern
} from '../../scripts/check-http-capability-allowlist.mjs'

const projectRoot = join(__dirname, '..', '..')

/** 与实际 capability 同构的最小 allow 集合（含 loopback + 一个非 loopback host） */
const BASE_ALLOW = [
  'https://gitee.com',
  'https://gitee.com:**',
  'https://api.siliconflow.cn',
  'https://api.siliconflow.cn:**',
  'https://translate.googleapis.com',
  'https://translate.googleapis.com:**',
  'https://localhost:**',
  'http://localhost:**',
  'https://127.0.0.1:**',
  'http://127.0.0.1:**'
]

function lists(entries: string[], files: string[] = CAPABILITY_FILES) {
  return Object.fromEntries(files.map((file) => [file, [...entries]]))
}

describe('check-http-capability-allowlist: splitHostPattern', () => {
  it('从 url 模式取 scheme + host（端口与路径通配忽略）', () => {
    expect(splitHostPattern('https://matrix.test')).toEqual({ scheme: 'https', host: 'matrix.test' })
    expect(splitHostPattern('https://matrix.test:**')).toEqual({ scheme: 'https', host: 'matrix.test' })
    expect(splitHostPattern('https://gitee.com/path/*')).toEqual({ scheme: 'https', host: 'gitee.com' })
    expect(splitHostPattern('http://127.0.0.1:**')).toEqual({ scheme: 'http', host: '127.0.0.1' })
  })

  it('非法输入返回 null（不抛错）', () => {
    expect(splitHostPattern('')).toBeNull()
    expect(splitHostPattern('gitee.com')).toBeNull()
    expect(splitHostPattern(undefined)).toBeNull()
  })
})

describe('check-http-capability-allowlist: extractHttpAllowEntries', () => {
  it('同时支持 string 与 { url } 两种写法', () => {
    const entries = extractHttpAllowEntries({
      permissions: [
        'core:default',
        { identifier: 'http:default', allow: [{ url: 'https://a.test' }, 'https://b.test'] },
        { identifier: 'fs:read-files', allow: [{ path: '$APPDATA/**' }] }
      ]
    })
    expect(entries).toEqual(['https://a.test', 'https://b.test'])
  })

  it('无 http:default 时返回空数组', () => {
    expect(extractHttpAllowEntries({ permissions: ['core:default'] })).toEqual([])
  })
})

describe('check-http-capability-allowlist: parseEnvHomeserver', () => {
  it('去掉包裹引号并忽略空值', () => {
    expect(parseEnvHomeserver('VITE_HOMESERVER_URL="https://matrix.test"')).toBe('https://matrix.test')
    expect(parseEnvHomeserver("VITE_HOMESERVER_URL='http://localhost:8008'")).toBe('http://localhost:8008')
    expect(parseEnvHomeserver('VITE_HOMESERVER_URL=')).toBeNull()
    expect(parseEnvHomeserver('OTHER=1')).toBeNull()
  })

  it('注释行不被误读', () => {
    expect(parseEnvHomeserver('# VITE_HOMESERVER_URL="https://ignore.test"')).toBeNull()
  })
})

describe('check-http-capability-allowlist: parseAllEnvHomeservers', () => {
  it('收录包含注释行在内的全部写法（.env.example 的两种受支持模式）', () => {
    const text = [
      '# Matrix Homeserver 地址，支持两种模式（二选一）：',
      'VITE_HOMESERVER_URL="http://localhost:8008"',
      '# VITE_HOMESERVER_URL="https://matrix.test"',
      'VITE_APP_NAME="HuLa"'
    ].join('\n')
    expect(parseAllEnvHomeservers(text)).toEqual(['http://localhost:8008', 'https://matrix.test'])
  })
})

describe('check-http-capability-allowlist: collectSanctionedDevHomeserverHosts', () => {
  it('合并 .env.example 全部 host 与默认 homeserver host', () => {
    const text = 'VITE_HOMESERVER_URL="http://localhost:8008"\n# VITE_HOMESERVER_URL="https://matrix.test"'
    expect(collectSanctionedDevHomeserverHosts(text)).toEqual(['localhost', 'matrix.test'])
  })

  it('默认值仍计入（即使 .env.example 未提及）', () => {
    expect(collectSanctionedDevHomeserverHosts('', 'https://matrix.test')).toEqual(['matrix.test'])
  })
})

describe('check-http-capability-allowlist: resolveHomeserver', () => {
  it('process.env 优先于环境文件', () => {
    const resolved = resolveHomeserver('/nonexistent-dir', { VITE_HOMESERVER_URL: 'https://from-env.test' })
    expect(resolved).toEqual({ url: 'https://from-env.test', source: 'process.env.VITE_HOMESERVER_URL' })
  })

  it('无 env 且无环境文件时返回 null（不抛错）', () => {
    expect(resolveHomeserver('/nonexistent-dir', {})).toEqual({ url: null, source: null })
  })
})

describe('check-http-capability-allowlist: evaluateHttpCapabilityAllowlist', () => {
  it('homeserver 非 loopback 且已覆盖 ⇒ 通过', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: lists([...BASE_ALLOW, 'https://matrix.test', 'https://matrix.test:**']),
      homeserverUrl: 'https://matrix.test',
      homeserverSource: '.env.local'
    })
    expect(result.ok).toBe(true)
    expect(result.homeserver).toMatchObject({ host: 'matrix.test', loopback: false })
    expect(result.testHosts).toEqual(['matrix.test'])
  })

  it('homeserver 非 loopback 但未覆盖 ⇒ 失败且报出应补条目', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: lists(BASE_ALLOW),
      homeserverUrl: 'https://matrix.test',
      homeserverSource: '.env.local'
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toContain('未覆盖 homeserver https://matrix.test')
    expect(result.problems.join('\n')).toContain('"https://matrix.test:**"')
  })

  it('scheme 不匹配不算覆盖（http homeserver 不能靠 https 条目放行）', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: lists([...BASE_ALLOW, 'https://hs.example.com']),
      homeserverUrl: 'http://hs.example.com',
      homeserverSource: '.env.local'
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toContain('http://hs.example.com')
  })

  it('loopback homeserver 无需显式条目', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: lists(BASE_ALLOW),
      homeserverUrl: 'http://localhost:8008',
      homeserverSource: '.env.example'
    })
    expect(result.ok).toBe(true)
    expect(result.homeserver.loopback).toBe(true)
  })

  it('未登记的 .test 域名 ⇒ 失败（防陈旧残留回归）', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: lists([...BASE_ALLOW, 'https://element.test', 'https://matrix.test', 'https://matrix.test:**']),
      homeserverUrl: 'https://matrix.test',
      homeserverSource: '.env.local'
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toContain('element.test')
    expect(result.testHosts).toEqual(['element.test', 'matrix.test'])
  })

  it('两端 allow 不一致 ⇒ 失败', () => {
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: {
        [CAPABILITY_FILES[0]]: [...BASE_ALLOW],
        [CAPABILITY_FILES[1]]: [...BASE_ALLOW, 'https://extra.example.com']
      },
      homeserverUrl: 'http://localhost:8008'
    })
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toContain('两端 allow 集合不一致')
  })

  it('基数断言：单文件 / 空 allow 条目 ⇒ 失败', () => {
    const single = evaluateHttpCapabilityAllowlist({ allowLists: { a: BASE_ALLOW } })
    expect(single.ok).toBe(false)
    expect(single.problems.join('\n')).toContain('基数断言失败')

    const empty = evaluateHttpCapabilityAllowlist({ allowLists: { a: [], b: [] } })
    expect(empty.ok).toBe(false)
    expect(empty.problems.join('\n')).toContain('allow 为空')
  })

  it('空输入不抛错但判定失败', () => {
    const result = evaluateHttpCapabilityAllowlist({})
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
  })
})

describe('check-http-capability-allowlist: coversHost', () => {
  it('端口与路径通配均视为覆盖', () => {
    expect(coversHost(['https://matrix.test'], 'https', 'matrix.test')).toBe(true)
    expect(coversHost(['https://matrix.test:**'], 'https', 'matrix.test')).toBe(true)
    expect(coversHost(['https://matrix.test/_matrix/*'], 'https', 'matrix.test')).toBe(true)
    expect(coversHost(['https://other.test'], 'https', 'matrix.test')).toBe(false)
  })
})

describe('check-http-capability-allowlist: 真实仓库自洽', () => {
  // 注意：这里刻意**只读受版本管理的文件**（`.env.example` + capabilities +
  // `scripts/updater-config.js`），不读 `.env.local`（gitignored，各人不同）⇒ 断言确定性。
  // 「本机实际 homeserver 是否覆盖」由 CLI 侧 `resolveHomeserver` 负责
  // （`pnpm check:http-allowlist`），其文件读取顺序已在上面单测锁定。
  const capabilityAllowLists = Object.fromEntries(
    CAPABILITY_FILES.map((rel) => [
      rel,
      extractHttpAllowEntries(JSON.parse(readFileSync(join(projectRoot, rel), 'utf8')))
    ])
  )
  const trackedEntries = Object.values(capabilityAllowLists).flat()
  const envExampleText = readFileSync(join(projectRoot, '.env.example'), 'utf8')
  const sanctioned = collectSanctionedDevHomeserverHosts(envExampleText)

  it('受管 dev homeserver 登记集合覆盖两种受支持模式', () => {
    expect(sanctioned).toContain('localhost')
    expect(sanctioned).toContain('matrix.test')
  })

  it('两端 capability 与受管默认 homeserver 对齐', () => {
    const exampleHomeserver = parseEnvHomeserver(envExampleText)
    expect(exampleHomeserver).not.toBeNull()
    const result = evaluateHttpCapabilityAllowlist({
      allowLists: capabilityAllowLists,
      homeserverUrl: exampleHomeserver,
      homeserverSource: '.env.example',
      sanctionedTestHosts: sanctioned
    })
    expect(result.problems).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('`tauri.conf.json` 默认 dev homeserver（matrix.test）已登记且被覆盖', () => {
    // tauri.conf.json 的 CSP connect-src 与 scripts/updater-config.js 的
    // DEFAULT_HOMESERVER_URL 都把 matrix.test 当作默认 homeserver；
    // capabilities 缺该 host 会让 nativeFetch 静默回退（2026-10-13 实测缺陷）。
    expect(coversHost(trackedEntries, 'https', 'matrix.test')).toBe(true)
    // 且不得只登记裸 host 而漏掉任意端口形态（与既有 gitee/siliconflow 约定一致）
    expect(trackedEntries).toContain('https://matrix.test:**')
  })

  it('无未登记的 .test 陈旧残留', () => {
    const testHosts = trackedEntries
      .map((entry) => splitHostPattern(entry))
      .filter((parsed) => parsed?.host.endsWith('.test'))
      .map((parsed) => parsed.host)
    expect([...new Set(testHosts)].every((testHost) => sanctioned.includes(testHost))).toBe(true)
  })
})
