#!/usr/bin/env node
/**
 * 推送投递联调探针（`kind: "http"` pusher）。
 *
 * 覆盖报告 §二「推送投递」那一条。本探针的重点不是「本机能不能收到 POST」，
 * 而是**证明投递链路真的被触发**（后端曾长期只有写入 `pushers` 表、没有读取与投递）。
 *
 * ## 实测到的两条硬约束（决定了判据怎么写）
 *
 * 1. **`data.url` 必须 https**：写路径 `validate_push_gateway_url` 先看 scheme，
 *    `http://…` 直接 `400 M_BAD_JSON "push gateway url must be https"`。
 * 2. **投递路径同样过这道守卫**：`PushGateway::send_notification` 第 231 行也调
 *    `validate_push_gateway_url`，所以 localhost / 私网 / IP 字面量一律被拒。
 *    ⇒ **本机或内网自建接收端永远收不到推送**，端到端 POST 必须有「https + 公网域名」。
 *
 * 因此判据拆成三层：
 *   P1 写路径：`http://` 被 400（scheme 校验）、`https://127.0.0.1` 被 403（SSRF 守卫）
 *   P2 读路径：绕过写路径直接把 pusher 落库，**其它成员**发消息后后端日志必须出现
 *      `Failed to deliver event to HTTP pusher` 且带本次 event_id
 *      ⇒ 证明 `deliver_event` 真的按 `data.url` 取到了 pusher 并发起投递（原缺陷就在这一步）
 *   P3 选择性：发送者自己的 pusher、`is_enabled=false` 的 pusher 都不触发投递
 *
 * 用法：
 *   E2EE_BASE=http://127.0.0.1:8008 node scripts/push-delivery-probe.mjs
 *   SYNAPSE_DB_CONTAINER=synapse-postgres SYNAPSE_APP_CONTAINER=synapse-app
 */

import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const DB_CONTAINER = process.env.SYNAPSE_DB_CONTAINER ?? 'synapse-postgres'
const APP_CONTAINER = process.env.SYNAPSE_APP_CONTAINER ?? 'synapse-app'
const RECEIVER_PORT = Number(process.env.PUSH_RECEIVER_PORT ?? 8799)
const PASSWORD = process.env.E2EE_PASSWORD ?? 'Push!probe9x8y7z'

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level !== 'pass') console.log('    证据：', JSON.stringify(evidence).slice(0, 380))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const docker = (args) => {
  try {
    return execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 })
  } catch (error) {
    return `ERR ${String(error.message ?? error).slice(0, 160)}`
  }
}
const psql = (sql) =>
  docker(['exec', DB_CONTAINER, 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql]).trim()
const appLogs = (sinceSec = 120) => docker(['logs', `--since`, `${sinceSec}s`, APP_CONTAINER])

/**
 * 某事件是否**真的**触发了投递。
 *
 * ⚠️ 必须逐行匹配：`Failed to deliver event to HTTP pusher` 与 `event_id=…` 要落在**同一行**。
 * 早先用「整段日志包含 A 且包含 B」的写法，会把 `notification_pipeline` 里带 event_id 的
 * INFO 行与别的投递 warn 拼在一起 ⇒ 自消息/停用场景假红（实测踩到）。
 */
const deliveryAttemptsFor = (log, eventId) =>
  String(log)
    .split('\n')
    .filter((line) => line.includes('Failed to deliver event to HTTP pusher') && line.includes(eventId))

async function rest(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000)
  })
  const text = await res.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    /* 保留原文 */
  }
  return { status: res.status, body: parsed, raw: text }
}

async function register(label) {
  const username = `push${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const res = await rest('POST', '/_matrix/client/v3/register', {
    body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } }
  })
  if (res.status !== 200) throw new Error(`注册 ${label} 失败：${res.status} ${res.raw.slice(0, 160)}`)
  return { label, userId: res.body.user_id, token: res.body.access_token, deviceId: res.body.device_id }
}

const startReceiver = () =>
  new Promise((resolve) => {
    const hits = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        hits.push({ path: req.url, raw: raw.slice(0, 200) })
        res.writeHead(200)
        res.end('{}')
      })
    })
    server.listen(RECEIVER_PORT, '127.0.0.1', () => resolve({ server, hits }))
  })

/** 直接落库（`pushkey_ts` 是 NOT NULL，写路径由服务端填；这里必须自己给） */
const insertPusher = ({ userId, deviceId, pushkey, url, enabled }) => {
  const data = JSON.stringify({ url, format: 'event_id_only' }).replace(/'/g, "''")
  const now = Date.now()
  return psql(`insert into pushers (user_id, device_id, pushkey, pushkey_ts, kind, app_id, app_display_name, device_display_name, lang, data, is_enabled, created_ts, updated_ts)
    values ('${userId}', '${deviceId}', '${pushkey}', ${now}, 'http', 'com.tjg.probe', 'TJG Probe', 'Probe Device', 'zh-CN', '${data}', ${enabled}, ${now}, ${now})
    on conflict (user_id, device_id, pushkey) do update set data = excluded.data, is_enabled = excluded.is_enabled, updated_ts = excluded.updated_ts
    returning id`)
}

const sendMessage = (token, roomId, text) =>
  rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
    token,
    body: { msgtype: 'm.text', body: text }
  })

const main = async () => {
  console.log(`后端=${BASE}  DB=${DB_CONTAINER}  应用容器=${APP_CONTAINER}  接收端=127.0.0.1:${RECEIVER_PORT}\n`)

  const a = await register('a')
  const b = await register('b')
  console.log(`A=${a.userId}  B=${b.userId}\n`)

  const created = await rest('POST', '/_matrix/client/v3/createRoom', {
    token: a.token,
    body: { preset: 'private_chat', name: 'e2e-push', invite: [b.userId] }
  })
  const roomId = created.body?.room_id
  if (!roomId) throw new Error(`建房失败：${created.status} ${created.raw.slice(0, 160)}`)
  await rest('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, { token: b.token, body: {} })

  const { server, hits } = await startReceiver()
  const pushkey = `probe-${Date.now()}`

  try {
    // ── P1 写路径的两道校验 ────────────────────────────────────────────────
    const httpAttempt = await rest('POST', '/_matrix/client/v3/pushers/set', {
      token: a.token,
      body: {
        pushkey,
        kind: 'http',
        app_id: 'com.tjg.probe',
        app_display_name: 'TJG Probe',
        device_display_name: 'Probe Device',
        lang: 'zh-CN',
        data: { url: `http://127.0.0.1:${RECEIVER_PORT}/_matrix/push/v1/notify`, format: 'event_id_only' }
      }
    })
    record(
      'P1',
      'data.url 必须是 https（http 被拒）',
      httpAttempt.status === 400 && /https/i.test(String(httpAttempt.body?.error ?? '')) ? 'pass' : 'fail',
      `status=${httpAttempt.status} errcode=${httpAttempt.body?.errcode ?? ''} msg=${String(httpAttempt.body?.error ?? '').slice(0, 70)}`
    )

    const httpsLocalAttempt = await rest('POST', '/_matrix/client/v3/pushers/set', {
      token: a.token,
      body: {
        pushkey,
        kind: 'http',
        app_id: 'com.tjg.probe',
        app_display_name: 'TJG Probe',
        device_display_name: 'Probe Device',
        lang: 'zh-CN',
        data: { url: `https://127.0.0.1:${RECEIVER_PORT}/_matrix/push/v1/notify`, format: 'event_id_only' }
      }
    })
    record(
      'P1',
      'SSRF 守卫拒绝本机/私网 https 回调',
      httpsLocalAttempt.status === 403 ? 'pass' : 'fail',
      `status=${httpsLocalAttempt.status} errcode=${httpsLocalAttempt.body?.errcode ?? ''} msg=${String(httpsLocalAttempt.body?.error ?? '').slice(0, 70)}`
    )

    // ── P2 读路径：落库 → 其它成员发消息 → 后端日志出现投递尝试 ──────────────
    const inserted = insertPusher({
      userId: a.userId,
      deviceId: a.deviceId,
      pushkey,
      url: `http://127.0.0.1:${RECEIVER_PORT}/_matrix/push/v1/notify`,
      enabled: 'true'
    })
    // psql 的返回值形如 "129\nINSERT 0 1"，取首行的自增 id
    record('P2', '落库 pusher（绕过写路径守卫）', /^\d+/m.test(inserted) ? 'pass' : 'fail', `id=${inserted.replace(/\n/g, ' ')}`)

    const sent = await sendMessage(b.token, roomId, 'push-probe')
    const eventId = sent.body?.event_id ?? ''
    record('P2', 'B 向房间发消息', sent.status === 200 && eventId ? 'pass' : 'fail', `event_id=${eventId}`)

    await sleep(8000)
    const log = appLogs(120)
    const attempts = deliveryAttemptsFor(log, eventId)
    record(
      'P2',
      '后端按 data.url 发起投递（同一行含本次 event_id）',
      attempts.length ? 'pass' : 'fail',
      attempts.length
        ? attempts[0].trim().slice(0, 200)
        : '未在日志中找到该事件的投递记录',
      attempts.length ? undefined : '日志里没有同一行同时含 event_id 与 HTTP pusher 的记录'
    )
    record(
      'P2',
      '本机接收端收不到（预期：投递也过 SSRF 守卫）',
      hits.length === 0 ? 'pass' : 'fail',
      `接收端命中 ${hits.length} 次；投递路径同样调 validate_push_gateway_url，故 http/本机目标必被拒`,
      hits[0]
    )

    // ── P3 选择性：自消息 / 停用 ───────────────────────────────────────────
    const selfSent = await sendMessage(a.token, roomId, 'self-message')
    await sleep(6000)
    const selfEventId = selfSent.body?.event_id ?? ''
    const selfAttempts = selfEventId ? deliveryAttemptsFor(appLogs(30), selfEventId) : []
    record(
      'P3',
      'A 自己发的消息不投递给 A 的 pusher',
      selfEventId && selfAttempts.length === 0 ? 'pass' : 'fail',
      `event_id=${selfEventId || '-'} 投递尝试=${selfAttempts.length}`
    )

    insertPusher({
      userId: a.userId,
      deviceId: a.deviceId,
      pushkey,
      url: `http://127.0.0.1:${RECEIVER_PORT}/_matrix/push/v1/notify`,
      enabled: 'false'
    })
    const disabledSent = await sendMessage(b.token, roomId, 'after-disable')
    await sleep(6000)
    const disabledEventId = disabledSent.body?.event_id ?? ''
    const disabledAttempts = disabledEventId ? deliveryAttemptsFor(appLogs(30), disabledEventId) : []
    record(
      'P3',
      'is_enabled=false 的 pusher 不参与投递',
      disabledEventId && disabledAttempts.length === 0 ? 'pass' : 'fail',
      `event_id=${disabledEventId || '-'} 投递尝试=${disabledAttempts.length}`
    )
  } finally {
    psql(`delete from pushers where user_id = '${a.userId}'`)
    server.close()
  }

  const passed = results.filter((r) => r.level === 'pass').length
  const failed = results.filter((r) => r.level === 'fail').length
  console.log(`\n结果：${passed} passed / ${failed} failed`)
  if (failed) {
    for (const item of results.filter((r) => r.level === 'fail')) console.log(`  ❌ [${item.stage}] ${item.name} — ${item.detail}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`\n探针异常：${String(error?.stack ?? error)}`)
  process.exit(1)
})
