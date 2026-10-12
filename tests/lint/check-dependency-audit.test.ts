import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  advisoryKey,
  buildBaseline,
  evaluateAuditGate,
  isBlocking,
  parseAuditReport,
  severityRank,
  summarizeBySeverity
} from '../../scripts/check-dependency-audit.mjs'

const projectRoot = join(__dirname, '..', '..')
const baselineFile = join(projectRoot, 'scripts', 'dependency-audit-baseline.json')

interface Advisory {
  id: string
  module: string
  severity: string
  title: string
  url: string
}

function advisory(module: string, id: string, severity: string): Advisory {
  return { module, id, severity, title: `${module} advisory`, url: '' }
}

describe('check-dependency-audit: severityRank / isBlocking', () => {
  it('按等级阶梯排序', () => {
    expect(severityRank('info')).toBe(0)
    expect(severityRank('high')).toBe(3)
    expect(severityRank('critical')).toBe(4)
  })

  it('未知等级返回 -1 且不阻断', () => {
    expect(severityRank('bogus')).toBe(-1)
    expect(isBlocking('bogus', 'high')).toBe(false)
  })

  it('阈值语义：>= threshold 才阻断', () => {
    expect(isBlocking('high', 'high')).toBe(true)
    expect(isBlocking('critical', 'high')).toBe(true)
    expect(isBlocking('moderate', 'high')).toBe(false)
    expect(isBlocking('high', 'critical')).toBe(false)
    expect(isBlocking('critical', 'critical')).toBe(true)
  })

  it('等级大小写不敏感', () => {
    expect(severityRank('HIGH')).toBe(3)
    expect(isBlocking('High', 'high')).toBe(true)
  })
})

describe('check-dependency-audit: parseAuditReport', () => {
  const fixture = JSON.stringify({
    advisories: {
      1153171: {
        id: 1153171,
        module_name: 'browserslist',
        severity: 'high',
        title: 'OOM via unbounded cache',
        url: 'https://example.test/1'
      },
      999: {
        id: 999,
        module_name: 'lodash',
        severity: 'moderate',
        title: 'ReDoS'
      }
    },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 1, critical: 0 } }
  })

  it('解析 advisories map 为数组并归一化字段', () => {
    const report = parseAuditReport(fixture)
    expect(report.advisories).toHaveLength(2)
    const browserslist = report.advisories.find((a: Advisory) => a.module === 'browserslist')
    expect(browserslist).toMatchObject({
      id: '1153171',
      module: 'browserslist',
      severity: 'high',
      url: 'https://example.test/1'
    })
  })

  it('接受已解析的对象（非字符串）', () => {
    const report = parseAuditReport(JSON.parse(fixture))
    expect(report.advisories).toHaveLength(2)
  })

  it('缺失 advisories 时返回空数组而非抛错', () => {
    const report = parseAuditReport({ metadata: { vulnerabilities: {} } })
    expect(report.advisories).toEqual([])
  })

  it('跳过非对象 advisory 值', () => {
    const report = parseAuditReport({
      advisories: { a: null, b: 'x', c: { id: 1, module_name: 'm', severity: 'low' } }
    })
    expect(report.advisories).toHaveLength(1)
  })

  it('非对象输入抛错', () => {
    expect(() => parseAuditReport('42')).toThrow()
  })

  it('保留 metadata.vulnerabilities', () => {
    const report = parseAuditReport(fixture)
    expect(report.metadata.vulnerabilities).toMatchObject({ high: 1, moderate: 1 })
  })
})

describe('check-dependency-audit: summarizeBySeverity', () => {
  it('按等级计数并给出 total', () => {
    const summary = summarizeBySeverity([
      advisory('a', '1', 'high'),
      advisory('b', '2', 'high'),
      advisory('c', '3', 'low'),
      advisory('d', '4', 'critical')
    ])
    expect(summary).toEqual({ info: 0, low: 1, moderate: 0, high: 2, critical: 1, total: 4 })
  })

  it('未知等级归入 info', () => {
    const summary = summarizeBySeverity([advisory('a', '1', 'weird')])
    expect(summary.info).toBe(1)
    expect(summary.total).toBe(1)
  })
})

describe('check-dependency-audit: advisoryKey / buildBaseline', () => {
  it('key 由 module + id 组成，与 title/url 无关', () => {
    expect(advisoryKey(advisory('browserslist', '1153171', 'high'))).toBe('browserslist::1153171')
  })

  it('buildBaseline 仅冻结达到阈值的项，去重且排序', () => {
    const payload = buildBaseline(
      [
        advisory('a', '1', 'high'),
        advisory('a', '1', 'high'),
        advisory('b', '2', 'low'),
        advisory('c', '3', 'critical')
      ],
      { threshold: 'high' }
    )
    expect(payload.count).toBe(2)
    expect(payload.threshold).toBe('high')
    expect(payload.advisories).toEqual(['a::1', 'c::3'])
  })
})

describe('check-dependency-audit: evaluateAuditGate', () => {
  it('无基线：非 strict 不阻断，strict 有阻断项即失败', () => {
    const raw = [advisory('a', '1', 'high')]
    expect(evaluateAuditGate(raw, null).failed).toBe(false)
    expect(evaluateAuditGate(raw, null).hasBaseline).toBe(false)
    expect(evaluateAuditGate(raw, null, { strict: true }).failed).toBe(true)
  })

  it('全部命中基线时不阻断', () => {
    const raw = [advisory('a', '1', 'high')]
    const baseline = { count: 1, advisories: new Set(['a::1']) }
    const result = evaluateAuditGate(raw, baseline)
    expect(result.blocking).toHaveLength(1)
    expect(result.regressed).toHaveLength(0)
    expect(result.countRegression).toBe(false)
    expect(result.failed).toBe(false)
  })

  it('出现基线外新高危时判回归', () => {
    const raw = [advisory('new', '2', 'critical')]
    const baseline = { count: 0, advisories: new Set<string>() }
    const result = evaluateAuditGate(raw, baseline)
    expect(result.regressed).toHaveLength(1)
    expect(result.failed).toBe(true)
  })

  it('低于阈值的项不参与阻断与计数', () => {
    const raw = [advisory('a', '1', 'moderate')]
    const baseline = { count: 0, advisories: new Set<string>() }
    const result = evaluateAuditGate(raw, baseline, { threshold: 'high' })
    expect(result.blocking).toHaveLength(0)
    expect(result.failed).toBe(false)
  })

  it('阻断计数超过基线时触发计数棘轮', () => {
    const raw = [advisory('a', '1', 'high'), advisory('b', '2', 'high')]
    const baseline = { count: 1, advisories: new Set(['a::1']) }
    const result = evaluateAuditGate(raw, baseline)
    expect(result.countRegression).toBe(true)
    expect(result.failed).toBe(true)
  })

  it('已解决项进入 fixed', () => {
    const raw = [advisory('a', '1', 'high')]
    const baseline = { count: 2, advisories: new Set(['a::1', 'gone::9']) }
    expect(evaluateAuditGate(raw, baseline).fixed).toEqual(['gone::9'])
  })

  it('置换（取消一个、新增一个）仍判回归', () => {
    const raw = [advisory('b', '2', 'high')]
    const baseline = { count: 1, advisories: new Set(['a::1']) }
    const result = evaluateAuditGate(raw, baseline)
    expect(result.countRegression).toBe(false)
    expect(result.regressed).toHaveLength(1)
    expect(result.failed).toBe(true)
  })
})

describe('check-dependency-audit: 基线文件自洽', () => {
  it('真实基线结构合法且计数与条目一致', () => {
    const parsed = JSON.parse(readFileSync(baselineFile, 'utf8'))
    expect(Array.isArray(parsed.advisories)).toBe(true)
    expect(parsed.count).toBe(parsed.advisories.length)
    expect(parsed.threshold).toBe('high')
    // 基线不得包含低于阻断阈值的项。
    for (const key of parsed.advisories as string[]) {
      expect(key).toMatch(/::/)
    }
  })

  it('空审计结果相对真实基线不阻断（门禁可绿）', () => {
    const parsed = JSON.parse(readFileSync(baselineFile, 'utf8'))
    const baseline = { count: Number(parsed.count), advisories: new Set<string>(parsed.advisories) }
    const result = evaluateAuditGate([], baseline, { threshold: parsed.threshold })
    expect(result.failed).toBe(false)
  })
})
