import { describe, expect, it } from 'vitest'
import { type AllowRule, isUrlAllowed, parseAllowRules } from '@/utils/hostAllowlist'

function rule(host: string, schemes: readonly string[] = ['https'], matchSubdomains = false): AllowRule {
  return { host, schemes, matchSubdomains }
}

describe('parseAllowRules', () => {
  it('parses comma-separated bare hosts with default schemes', () => {
    const { rules, warnings } = parseAllowRules('gitee.com, api.siliconflow.cn')
    expect(warnings).toEqual([])
    expect(rules).toEqual([
      { host: 'gitee.com', schemes: ['https', 'http'], matchSubdomains: false },
      { host: 'api.siliconflow.cn', schemes: ['https', 'http'], matchSubdomains: false }
    ])
  })

  it('parses explicit scheme entries and semicolon separators', () => {
    const { rules } = parseAllowRules('https://translate.googleapis.com; http://localhost')
    expect(rules).toEqual([
      { host: 'translate.googleapis.com', schemes: ['https'], matchSubdomains: false },
      { host: 'localhost', schemes: ['http'], matchSubdomains: false }
    ])
  })

  it('supports wildcard subdomain entries', () => {
    const { rules } = parseAllowRules('https://*.example.com')
    expect(rules).toEqual([{ host: 'example.com', schemes: ['https'], matchSubdomains: true }])
  })

  it('lowercases hosts and merges duplicate hosts', () => {
    const { rules } = parseAllowRules('GITEE.com, https://gitee.com')
    expect(rules).toEqual([{ host: 'gitee.com', schemes: ['https', 'http'], matchSubdomains: false }])
  })

  it('strips ports from rule hosts', () => {
    const { rules } = parseAllowRules('http://localhost:3333')
    expect(rules).toEqual([{ host: 'localhost', schemes: ['http'], matchSubdomains: false }])
  })

  it('skips invalid entries and reports warnings', () => {
    const { rules, warnings } = parseAllowRules('gitee.com, http://, bad host')
    expect(rules.map((r) => r.host)).toEqual(['gitee.com'])
    expect(warnings).toHaveLength(2)
  })

  it('returns empty rules for empty input', () => {
    expect(parseAllowRules('').rules).toEqual([])
    expect(parseAllowRules('   ').rules).toEqual([])
  })

  it('parses JSON array form', () => {
    const { rules, warnings } = parseAllowRules('[{"host":"gitee.com","schemes":["https"]},"api.example.com"]')
    expect(warnings).toEqual([])
    expect(rules).toEqual([
      { host: 'gitee.com', schemes: ['https'], matchSubdomains: false },
      { host: 'api.example.com', schemes: ['https', 'http'], matchSubdomains: false }
    ])
  })

  it('reports a warning for malformed JSON', () => {
    const { rules, warnings } = parseAllowRules('[not json')
    expect(rules).toEqual([])
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe('isUrlAllowed', () => {
  const rules: AllowRule[] = [
    rule('gitee.com'),
    rule('api.siliconflow.cn'),
    rule('example.com', ['https'], true),
    rule('localhost', ['http'])
  ]

  it('allows a url whose host matches exactly', () => {
    const decision = isUrlAllowed('https://gitee.com/repos/x', rules, 'prod')
    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.host).toBe('gitee.com')
      expect(decision.rule.host).toBe('gitee.com')
    }
  })

  it('normalizes case and ignores the port', () => {
    expect(isUrlAllowed('https://GITEE.com:8443/path?q=1', rules, 'prod').allowed).toBe(true)
  })

  it('strips a trailing dot in the host', () => {
    expect(isUrlAllowed('https://gitee.com./x', rules, 'prod').allowed).toBe(true)
  })

  it('rejects unknown hosts with no-rule', () => {
    expect(isUrlAllowed('https://evil.example.net/x', rules, 'prod')).toMatchObject({
      allowed: false,
      reason: 'no-rule',
      host: 'evil.example.net'
    })
  })

  it('rejects scheme mismatch', () => {
    expect(isUrlAllowed('http://example.com/x', rules, 'dev')).toMatchObject({
      allowed: false,
      reason: 'scheme-mismatch',
      host: 'example.com'
    })
  })

  it('matches subdomains only when matchSubdomains is set', () => {
    expect(isUrlAllowed('https://a.example.com/x', rules, 'prod').allowed).toBe(true)
    expect(isUrlAllowed('https://notexample.com/x', rules, 'prod')).toMatchObject({ allowed: false, reason: 'no-rule' })
  })

  it('rejects invalid urls', () => {
    expect(isUrlAllowed('not-a-url', rules, 'prod')).toMatchObject({
      allowed: false,
      reason: 'invalid-url',
      host: null
    })
  })

  it('blocks plaintext http for non-loopback hosts in prod but allows it in dev', () => {
    const plain: AllowRule[] = [rule('api.example.com', ['http', 'https'])]
    expect(isUrlAllowed('http://api.example.com/x', plain, 'dev').allowed).toBe(true)
    expect(isUrlAllowed('http://api.example.com/x', plain, 'prod')).toMatchObject({
      allowed: false,
      reason: 'scheme-mismatch'
    })
  })

  it('keeps loopback plaintext http allowed in prod', () => {
    expect(isUrlAllowed('http://localhost:3333/mcp', rules, 'prod').allowed).toBe(true)
    expect(isUrlAllowed('http://127.0.0.1:9090/x', [rule('127.0.0.1', ['http'])], 'prod').allowed).toBe(true)
  })
})
