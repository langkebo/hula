/**
 * PII redaction for log frames (plan §18.6.3).
 *
 * Rules:
 *   - access tokens / bearer secrets → "***"
 *   - e-mail → "local***@domain"
 *   - phone numbers → keep last 4 digits only
 *   - room IDs / event IDs left as-is (opaque)
 *   - message content must NEVER be logged above `trace` level — this
 *     function redacts obvious content fields defensively but the real
 *     gate is the logger API.
 *
 * Input may be a string, an object, or an array. Non-string leaves are
 * returned unchanged. The output is a deep copy — the input is not
 * mutated.
 */

const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g
const BEARER_RE = /(bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi
// matrix access_token / refresh_token / password-like keys inline
const TOKEN_KV_RE = /("(?:access_token|refresh_token|password|token|authorization)")\s*:\s*"([^"]+)"/gi

const SENSITIVE_KEYS = new Set([
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'password',
  'authorization',
  'Authorization',
  'token'
])

const CONTENT_KEYS = new Set(['body', 'formatted_body', 'text', 'content'])

export function redactString(input: string): string {
  let out = input
  out = out.replace(BEARER_RE, (_m, p1) => `${p1}***`)
  out = out.replace(TOKEN_KV_RE, (_m, key) => `${key}:"***"`)
  out = out.replace(EMAIL_RE, (_m, local: string, domain: string) => {
    const head = local.length <= 1 ? local : local[0]
    return `${head}***@${domain}`
  })
  out = out.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, '')
    if (digits.length < 8) return match
    return `***${digits.slice(-4)}`
  })
  return out
}

export function redactPII<T>(value: T): T {
  return redactInternal(value, new WeakSet()) as T
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value)
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value as object)) return '[circular]'
  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.map((v) => redactInternal(v, seen))
  }

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack }
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '***'
      continue
    }
    if (CONTENT_KEYS.has(k) && typeof v === 'string') {
      out[k] = v.length > 0 ? '[redacted:content]' : v
      continue
    }
    out[k] = redactInternal(v, seen)
  }
  return out
}
