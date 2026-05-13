import { describe, expect, it } from 'vitest'
import { redactPII, redactString } from '../redactPII'

describe('redactPII', () => {
  it('redacts bearer tokens in strings', () => {
    expect(redactString('Authorization: Bearer abc123xyz789def')).toContain('Bearer ***')
  })

  it('redacts access_token JSON values', () => {
    const body = '{"access_token":"secret-token-value","user":"u"}'
    expect(redactString(body)).toContain('"access_token":"***"')
    expect(redactString(body)).toContain('"user":"u"')
  })

  it('masks email local part', () => {
    expect(redactString('contact alice@example.com')).toBe('contact a***@example.com')
    expect(redactString('a@example.com')).toBe('a***@example.com')
  })

  it('keeps last 4 digits of phone numbers', () => {
    expect(redactString('call +1 415-555-2671 now')).toContain('***2671')
  })

  it('deep-redacts sensitive keys in objects', () => {
    const out = redactPII({
      user: 'alice',
      access_token: 'xyz',
      nested: { password: 'p', email: 'bob@hula.example' }
    }) as Record<string, any>
    expect(out.access_token).toBe('***')
    expect(out.nested.password).toBe('***')
    expect(out.nested.email).toBe('b***@hula.example')
  })

  it('redacts message content fields defensively', () => {
    const out = redactPII({ body: 'hello', formatted_body: '<b>hi</b>', text: 'x' }) as Record<string, string>
    expect(out.body).toBe('[redacted:content]')
    expect(out.formatted_body).toBe('[redacted:content]')
    expect(out.text).toBe('[redacted:content]')
  })

  it('handles circular objects without blowing up', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    const out = redactPII(a) as Record<string, unknown>
    expect(out.self).toBe('[circular]')
  })

  it('handles Error instances', () => {
    const e = new Error('token=abcd1234abcd1234 for bob@example.com')
    const out = redactPII(e) as { name: string; message: string }
    expect(out.name).toBe('Error')
    expect(out.message).toContain('b***@example.com')
  })

  it('preserves room and event IDs as-is', () => {
    const s = 'room !abc:server sent event $evt:server'
    expect(redactString(s)).toBe(s)
  })
})
