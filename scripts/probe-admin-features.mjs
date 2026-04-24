#!/usr/bin/env node
/**
 * Admin feature readiness probe.
 *
 * Hits the 3 UX-gated admin domains (SAML, Security, ServerLogs) on a real
 * synapse-rust homeserver and classifies the responses so the "功能尚未就绪"
 * banners in `AdminSaml.vue` / `AdminSecurity.vue` / `AdminServerLogs.vue`
 * can be removed with confidence.
 *
 * Usage:
 *   HOMESERVER_URL=https://hs.example.com \
 *   ADMIN_ACCESS_TOKEN=syt_xxx \
 *   node scripts/probe-admin-features.mjs
 *
 * Optional:
 *   TIMEOUT_MS=5000     per-request timeout (default 5000)
 *   JSON=1              emit JSON report instead of human-readable table
 *
 * Exit code:
 *   0  every endpoint is fully ready (200 + non-empty payload)
 *   1  at least one endpoint is unavailable / empty / errored
 *   2  configuration error (missing HOMESERVER_URL / ADMIN_ACCESS_TOKEN)
 */

const HOMESERVER_URL = process.env.HOMESERVER_URL
const ADMIN_ACCESS_TOKEN = process.env.ADMIN_ACCESS_TOKEN
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 5000)
const EMIT_JSON = process.env.JSON === '1'

if (!HOMESERVER_URL || !ADMIN_ACCESS_TOKEN) {
  console.error('ERROR: HOMESERVER_URL and ADMIN_ACCESS_TOKEN env vars are required.')
  console.error('Example:')
  console.error('  HOMESERVER_URL=https://hs.example.com \\')
  console.error('  ADMIN_ACCESS_TOKEN=syt_xxx \\')
  console.error('  node scripts/probe-admin-features.mjs')
  process.exit(2)
}

const BASE = HOMESERVER_URL.replace(/\/+$/, '')

/**
 * @typedef {{
 *   domain: string
 *   name: string
 *   path: string
 *   payloadField?: string
 * }} Probe
 */

/** @type {Probe[]} */
const PROBES = [
  {
    domain: 'SAML',
    name: 'getSamlConfig',
    path: '/_synapse/admin/v1/saml/config'
  },
  {
    domain: 'Security',
    name: 'getSecurityEvents',
    path: '/_synapse/admin/v1/security/events?limit=1',
    payloadField: 'events'
  },
  {
    domain: 'Security',
    name: 'getIpBlocks',
    path: '/_synapse/admin/v1/security/ip/blocks'
  },
  {
    domain: 'ServerLogs',
    name: 'getServerLogs',
    path: '/_synapse/admin/v1/logs?limit=1'
  }
]

/**
 * Classify an HTTP response for readiness decisions.
 *
 * - `ready`      — 200 with a non-empty payload (keys present or list length > 0)
 * - `empty`      — 200 but the body has no meaningful content; the endpoint
 *                  exists but there is no data to surface yet
 * - `unauthorized` — 401 / 403; token or admin permission issue, not a
 *                  readiness signal
 * - `not_found` — 404; endpoint not implemented on this synapse-rust build
 * - `server_error` — 5xx; backend crashed or rejected
 * - `timeout`   — request exceeded `TIMEOUT_MS`
 * - `network`   — DNS / TCP / TLS failure
 * - `other`     — anything else (4xx that isn't 401/403/404)
 *
 * @param {{ status: number, body: unknown } | { error: 'timeout' } | { error: 'network', detail: string }} result
 * @param {string | undefined} payloadField
 * @returns {{ classification: string, summary: string }}
 */
function classify(result, payloadField) {
  if ('error' in result && result.error === 'timeout') {
    return { classification: 'timeout', summary: `> ${TIMEOUT_MS}ms` }
  }
  if ('error' in result && result.error === 'network') {
    return { classification: 'network', summary: result.detail }
  }

  const { status, body } = /** @type {{ status: number, body: unknown }} */ (result)

  if (status === 401 || status === 403) return { classification: 'unauthorized', summary: `HTTP ${status}` }
  if (status === 404) return { classification: 'not_found', summary: 'HTTP 404' }
  if (status >= 500) return { classification: 'server_error', summary: `HTTP ${status}` }
  if (status !== 200) return { classification: 'other', summary: `HTTP ${status}` }

  // 200 — decide ready vs empty
  if (body == null) return { classification: 'empty', summary: 'null body' }
  if (typeof body !== 'object') return { classification: 'ready', summary: `scalar: ${String(body)}` }

  if (payloadField && Array.isArray(/** @type {Record<string, unknown>} */ (body)[payloadField])) {
    const arr = /** @type {unknown[]} */ (/** @type {Record<string, unknown>} */ (body)[payloadField])
    return arr.length > 0
      ? { classification: 'ready', summary: `${payloadField}.length=${arr.length}` }
      : { classification: 'empty', summary: `${payloadField}.length=0` }
  }

  if (Array.isArray(body)) {
    return body.length > 0
      ? { classification: 'ready', summary: `array.length=${body.length}` }
      : { classification: 'empty', summary: 'array.length=0' }
  }

  const keys = Object.keys(/** @type {Record<string, unknown>} */ (body))
  return keys.length > 0
    ? { classification: 'ready', summary: `keys=[${keys.slice(0, 4).join(',')}${keys.length > 4 ? ',…' : ''}]` }
    : { classification: 'empty', summary: '{}' }
}

/**
 * @param {Probe} probe
 */
async function runProbe(probe) {
  const url = `${BASE}${probe.path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const started = performance.now()

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ADMIN_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    })
    const elapsed = Math.round(performance.now() - started)
    let body = null
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    const { classification, summary } = classify({ status: res.status, body }, probe.payloadField)
    return { ...probe, status: res.status, classification, summary, elapsed }
  } catch (err) {
    const elapsed = Math.round(performance.now() - started)
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      const { classification, summary } = classify({ error: 'timeout' }, probe.payloadField)
      return { ...probe, status: 0, classification, summary, elapsed }
    }
    const detail = err instanceof Error ? err.message : String(err)
    const { classification, summary } = classify({ error: 'network', detail }, probe.payloadField)
    return { ...probe, status: 0, classification, summary, elapsed }
  } finally {
    clearTimeout(timer)
  }
}

const results = []
for (const probe of PROBES) {
  results.push(await runProbe(probe))
}

if (EMIT_JSON) {
  console.log(JSON.stringify({ homeserver: BASE, results }, null, 2))
} else {
  console.log('')
  console.log(`Homeserver: ${BASE}`)
  console.log(`Timeout:    ${TIMEOUT_MS}ms`)
  console.log('')
  console.log('Domain      Endpoint               HTTP  Elapsed  Status         Detail')
  console.log('-------     ----------------       ----  -------  -------------  -----------------------------')
  for (const r of results) {
    const domain = r.domain.padEnd(10)
    const name = r.name.padEnd(22)
    const status = String(r.status || '-').padStart(4)
    const elapsed = `${r.elapsed}ms`.padStart(7)
    const cls = r.classification.padEnd(13)
    console.log(`${domain}  ${name}  ${status}  ${elapsed}  ${cls}  ${r.summary}`)
  }
  console.log('')

  // Per-domain summary: remove banner only when every probe in that domain is `ready`.
  const domainVerdict = new Map()
  for (const r of results) {
    const current = domainVerdict.get(r.domain) ?? { ready: true, anyReady: false, probes: [] }
    current.probes.push(r)
    if (r.classification !== 'ready') current.ready = false
    if (r.classification === 'ready') current.anyReady = true
    domainVerdict.set(r.domain, current)
  }

  console.log('Banner recommendation:')
  for (const [domain, verdict] of domainVerdict) {
    if (verdict.ready) {
      console.log(`  ${domain.padEnd(10)}  REMOVE banner (all probes ready)`)
    } else if (verdict.anyReady) {
      console.log(`  ${domain.padEnd(10)}  KEEP banner  (partial readiness — file backend issues per-endpoint)`)
    } else {
      console.log(`  ${domain.padEnd(10)}  KEEP banner  (backend not ready)`)
    }
  }
  console.log('')
}

const allReady = results.every((r) => r.classification === 'ready')
process.exit(allReady ? 0 : 1)
