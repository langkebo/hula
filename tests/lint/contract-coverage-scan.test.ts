import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CALL_PROBES,
  collectStringConsts,
  expandConsts,
  extractUrls,
  normalizeUrlLiteral
} from '../../scripts/contract-coverage-scan.mjs'

/**
 * 门禁单测：`contract-coverage-scan.mjs` 的 **URL 字面量提取器**。
 *
 * 背景（2026-10-14 实测到的真缺陷）：`contract-coverage-map.json` 是提交进仓的
 * artifact，却报 `totalUrls: 0` —— 看起来"前端已经没有裸调了"。实际原因是提取器
 * 有两层盲区，把它自己文档里承诺能抓的形态全部漏掉了：
 *
 *   1. **常量前缀 + 模板**：`` `${PREFIX_V3}/register/captcha/send` `` 经
 *      `normalizeUrlLiteral` 变成 `{PREFIX_V3}/…`，随后"从第一个 `/` 切片"得到
 *      `/register/captcha/send`，**不匹配 `^/(_matrix|_synapse|.well-known)` 命名空间过滤** ⇒ 丢弃；
 *   2. **函数名探针表过期**：仓里真实在用的是 `postMatrixJson<T>(…)` / `postJson<T>(…)` /
 *      `getRuntimeAwareFetch()(…)`，而表里只有 `apiRequest` / `runtimeFetch` / `HttpClient.*`。
 *
 * 后果：`auth/` 域（登录、注册、验证码、令牌交换）的 8+ 处硬编码路径**完全不可见**，
 * map 里 `authHelpers.ts` 记的是 `callCount: 1 / urlCount: 0`（实际 10 / 6）。
 */

const PREFIXES = new Map([
  ['PREFIX_V3', '/_matrix/client/v3'],
  ['PREFIX_VENDOR_V1', '/_matrix/vendor/v1']
])

describe('contract-coverage-scan: URL 字面量提取', () => {
  it('回归：常量前缀 + 模板（本次修的盲区）现在能被解析出来', () => {
    const src = "return postMatrixJson<MatrixLoginResult>(`${PREFIX_V3}/login`, {}, '失败')"
    expect(extractUrls(src, PREFIXES)).toEqual(['/_matrix/client/v3/login'])
  })

  it('回归对照：不给常量表时，同一个调用确实抓不到（证明旧行为就是盲区）', () => {
    const src = "return postMatrixJson<MatrixLoginResult>(`${PREFIX_V3}/login`, {}, '失败')"
    expect(extractUrls(src)).toEqual([])
  })

  it('`postJson` 与 `postMatrixJson` 同族都要覆盖', () => {
    expect(extractUrls('postJson(`${PREFIX_V3}/login`, {})', PREFIXES)).toEqual(['/_matrix/client/v3/login'])
  })

  it('受控 fetch 的新拼写 `getRuntimeAwareFetch()(…)` 要覆盖', () => {
    expect(extractUrls("getRuntimeAwareFetch()('/_matrix/client/v3/login', {})")).toEqual(['/_matrix/client/v3/login'])
    expect(extractUrls('getRuntimeAwareFetch()(`/_matrix/client/v3/logout`, {})')).toEqual([
      '/_matrix/client/v3/logout'
    ])
  })

  it('纯字符串字面量照旧可提取（含 vendor 前缀）', () => {
    expect(extractUrls("apiRequest('/_matrix/vendor/v1/friends', {})")).toEqual(['/_matrix/vendor/v1/friends'])
    expect(extractUrls('authedRequest(`${PREFIX_VENDOR_V1}/rooms`, {})', PREFIXES)).toEqual([
      '/_matrix/vendor/v1/rooms'
    ])
  })

  it('未知标识符不崩，退回"从第一个 / 切片"的行为', () => {
    // `${baseUrl}` 是运行时值 ⇒ 不在常量表里 ⇒ 切片后应仍能取到 /_matrix/…
    expect(extractUrls('runtimeFetch(`${baseUrl}/_matrix/client/v3/sync`, {})')).toEqual(['/_matrix/client/v3/sync'])
  })

  it('非 Matrix/Synapse 命名空间一律丢弃（保持输出精简）', () => {
    expect(extractUrls("apiRequest('/api/internal/thing', {})")).toEqual([])
    expect(extractUrls('runtimeFetch(`/custom/${x}/path`)')).toEqual([])
  })

  it('剥离 query 与 hash（ledger 路径两者都不带）', () => {
    expect(normalizeUrlLiteral('/_matrix/client/v3/sync?since=s1')).toBe('/_matrix/client/v3/sync')
    expect(normalizeUrlLiteral('/_matrix/client/v3/sync#frag')).toBe('/_matrix/client/v3/sync')
  })

  it('运行时插值规范化为 {name}，匿名插值为 {param}', () => {
    expect(extractUrls('runtimeFetch(`/_matrix/client/v3/rooms/${roomId}/summary`)')).toEqual([
      '/_matrix/client/v3/rooms/{roomId}/summary'
    ])
    expect(extractUrls('runtimeFetch(`/_matrix/client/v3/rooms/${id ?? fallback}/summary`)')).toEqual([
      '/_matrix/client/v3/rooms/{param}/summary'
    ])
  })
})

describe('contract-coverage-scan: 常量收集', () => {
  it('收 `const` / `export const` 的字符串字面量赋值', () => {
    const consts = collectStringConsts(
      ["export const PREFIX_V3 = '/_matrix/client/v3'", '  const LOCAL = "/x"'].join('\n')
    )
    expect(consts.get('PREFIX_V3')).toBe('/_matrix/client/v3')
    expect(consts.get('LOCAL')).toBe('/x')
  })

  it('不收计算值 / 模板赋值（收不到就退回原行为，不猜）', () => {
    const consts = collectStringConsts(['const A = makePrefix()', 'const B = `${C}/x`'].join('\n'))
    expect(consts.size).toBe(0)
  })

  it('expandConsts 只替换已知标识符，未知的原样保留（最多迭代 3 轮）', () => {
    expect(expandConsts('${A}/x', new Map([['A', '/p']]))).toBe('/p/x')
    expect(expandConsts('${UNKNOWN}/x', new Map([['A', '/p']]))).toBe('${UNKNOWN}/x')
  })
})

/**
 * **防漂移**（本次缺陷能长期存活的机制原因）：探针表必须覆盖仓库里真实出现的调用名。
 * 这里从源码反推"紧跟 `${PREFIX_*}` 模板的调用名"，逐个要求被 CALL_PROBES 命中。
 */
describe('contract-coverage-scan: 探针表与仓库真实调用名同步', () => {
  const SERVICES_ROOT = join(process.cwd(), 'src', 'services')
  const SKIP = /__tests__|\.test\.ts$|\.spec\.ts$|\.d\.ts$/

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === '__tests__') continue
        walk(full, out)
      } else if (full.endsWith('.ts') && !SKIP.test(full)) {
        out.push(full)
      }
    }
    return out
  }

  /** 仓库里被当作路径首参使用的调用名（排除 paths/ 路径构造器目录）。 */
  function usedPathCallNames(): string[] {
    const names = new Set<string>()
    const re = /([A-Za-z_$][\w$]*)\s*(?:<[^<>()]{0,120}>)?\s*\(\s*`\$\{PREFIX_[A-Z0-9_]+\}/
    for (const file of walk(SERVICES_ROOT)) {
      if (file.includes(`${join('src', 'services', 'matrix', 'paths')}`)) continue
      const text = readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) names.add(m[1])
    }
    return [...names].sort()
  }

  it('本仓真实使用的每个路径调用名都被 CALL_PROBES 命中', () => {
    const used = usedPathCallNames()

    // 基数断言：反推集合为空说明这段探针逻辑本身失效了（比"全绿"更该报警）
    expect(used.length, `反推不到任何调用名，检查 ${relative(process.cwd(), SERVICES_ROOT)} 是否还在`).toBeGreaterThan(
      0
    )

    const uncovered = used.filter(
      (name) => !CALL_PROBES.some(({ pattern }) => new RegExp(pattern.source).test(`${name}(`))
    )
    expect(uncovered, `这些调用名没被 CALL_PROBES 覆盖（会重新变成检测盲区）: ${uncovered.join(', ')}`).toEqual([])
  })
})
