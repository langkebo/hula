#!/usr/bin/env node
/**
 * E2EE 真机/模拟器联调冒烟脚本（协议层）
 *
 * 目的：在「移动端模拟器 + 桌面端」这条链路上，把 E2EE 的**协议前置**逐层跑一遍，
 * 分清「客户端 crypto 没起来」和「服务端不支持」这两种失败，避免一上来就看到
 * 一句「消息发送失败」而无从定位。
 *
 * 覆盖（严格按依赖顺序，任一层失败即停，避免下游结论失真）：
 *   L0 环境      — homeserver 可达 / 版本与 unstable features
 *   L1 加密房    — createRoom + m.room.encryption + 对端 join + 回读 state
 *   L2 明文通道  — 双向 m.room.message（证明房间与权限没问题）
 *   L3 加密事件  — 双向 m.room.encrypted（证明服务端**接受并完整存储**密文字段）
 *   L4 设备密钥  — /keys/upload → /keys/query → /keys/claim（E2EE 真正的前置）
 *   L5 to-device — SAS 握手事件（request/ready/key/mac/done）双向投递
 *
 * ⚠️ 本脚本**不**做真实加解密：Megolm/Olm 的密钥协商发生在客户端（Rust crypto），
 * 服务端侧只能验「通道是否放行 + 字段是否完整」。真正的加解密必须由两端客户端完成，
 * 因此 L3 的 ciphertext 是**占位串**，脚本会在输出里明确标注它不是真密文。
 *
 * 用法：
 *   node scripts/e2ee-device-smoke.mjs                     # 默认 http://127.0.0.1:8008
 *   E2EE_BASE=http://10.0.2.2:8008 node scripts/e2ee-device-smoke.mjs
 *   E2EE_JSON=1 node scripts/e2ee-device-smoke.mjs         # 只输出 JSON（给 CI）
 */

import { generateKeyPairSync, sign } from 'node:crypto'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const JSON_ONLY = process.env.E2EE_JSON === '1'
const SERVER_NAME = process.env.E2EE_SERVER_NAME ?? ''
const TIMEOUT_MS = Number(process.env.E2EE_TIMEOUT_MS ?? 20000)

const results = []
let fatal = null

const log = (...args) => {
  if (!JSON_ONLY) console.log(...args)
}

/** 记录一条断言。level: pass | fail | skip | info */
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail, evidence: evidence ?? null })
  if (!JSON_ONLY) {
    const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
    console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 带超时与 429 重试的 fetch；返回 { status, body, headers, raw } */
async function call(method, path, { token, body, headers, retry429 = true } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }
  let res = await fetch(url, init)
  // register/login 桶是 5/s、burst 10：连打必撞，按 Retry-After 退避
  for (let i = 0; i < 6 && retry429 && res.status === 429; i += 1) {
    const wait = Number(res.headers.get('retry-after') ?? 1) * 1000
    await sleep(Math.min(Math.max(wait, 500), 5000))
    res = await fetch(url, init)
  }
  const text = await res.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    /* 保留原文 */
  }
  return { status: res.status, body: parsed, headers: res.headers, raw: text }
}

const rand = (n) => {
  const cs = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < n; i += 1) s += cs[Math.floor(Math.random() * cs.length)]
  return s
}

const bytesB64 = (n) => Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256))).toString('base64')

async function register(label) {
  const username = `e2ee${label}${Date.now().toString(36)}${rand(4)}`
  const res = await call('POST', '/_matrix/client/v3/register', {
    body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' }, inhibit_login: false }
  })
  if (res.status !== 200) throw new Error(`register ${username} 失败: ${res.status} ${res.raw.slice(0, 200)}`)
  return {
    username,
    userId: res.body.user_id,
    accessToken: res.body.access_token,
    deviceId: res.body.device_id,
    password: PASSWORD
  }
}

/** 让该账号拥有一个稳定的 device_id（重新登录时复用），便于 SAS 场景 */
async function ensureDevice(account, deviceId, displayName) {
  const res = await call('POST', '/_matrix/client/v3/login', {
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: account.username },
      password: PASSWORD,
      device_id: deviceId,
      initial_device_display_name: displayName
    }
  })
  if (res.status !== 200) throw new Error(`login 失败: ${res.status} ${res.raw.slice(0, 200)}`)
  return { ...account, accessToken: res.body.access_token, deviceId: res.body.device_id }
}

// ── L0 环境 ─────────────────────────────────────────────────────────────────
async function stage0() {
  const ver = await call('GET', '/_matrix/client/versions')
  if (ver.status !== 200) {
    record('L0', 'homeserver 可达', 'fail', `GET /versions → ${ver.status}`)
    throw new Error('homeserver 不可达，后续阶段无意义')
  }
  const versions = ver.body?.versions ?? []
  const unstable = ver.body?.unstable_features ?? {}
  record('L0', 'homeserver 可达', 'pass', `${BASE}，${versions.length} 个版本`, { versions: versions.slice(-3) })

  const caps = await call('GET', '/_matrix/client/v3/capabilities')
  const roomVersions = caps.body?.capabilities?.['m.room_versions'] ?? {}
  record(
    'L0',
    '房间版本能力',
    caps.status === 200 ? 'pass' : 'fail',
    `default=${roomVersions.default ?? '?'} available=${Object.keys(roomVersions.available ?? {}).length} 个`,
    { default: roomVersions.default, available: Object.keys(roomVersions.available ?? {}) }
  )
  return { versions, unstable, roomVersions }
}

// ── L1 加密房 ────────────────────────────────────────────────────────────────
async function stage1(a, b) {
  const name = `e2ee-${Date.now().toString(36)}`
  const create = await call('POST', '/_matrix/client/v3/createRoom', {
    token: a.accessToken,
    body: {
      name,
      preset: 'private_chat',
      invite: [b.userId],
      initial_state: [
        {
          type: 'm.room.encryption',
          state_key: '',
          content: { algorithm: 'm.megolm.v1.aes-sha2', rotation_period_ms: 604800000, rotation_period_msgs: 100 }
        }
      ]
    }
  })
  if (create.status !== 200) {
    record('L1', '建加密房', 'fail', `createRoom → ${create.status} ${create.raw.slice(0, 160)}`)
    throw new Error('建加密房失败')
  }
  const roomId = create.body.room_id
  record('L1', '建加密房', 'pass', roomId, { room_id: roomId })

  const enc = await call('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.encryption`, {
    token: a.accessToken
  })
  const algo = enc.body?.algorithm
  record(
    'L1',
    'm.room.encryption 落库',
    enc.status === 200 && algo === 'm.megolm.v1.aes-sha2' ? 'pass' : 'fail',
    `status=${enc.status} algorithm=${algo ?? 'null'}`,
    enc.body
  )

  const join = await call('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
    token: b.accessToken,
    body: {}
  })
  record('L1', '对端 join', join.status === 200 ? 'pass' : 'fail', `status=${join.status}`, join.body)

  const members = await call('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`, {
    token: a.accessToken
  })
  const n = Object.keys(members.body?.joined ?? {}).length
  record('L1', '成员数', n === 2 ? 'pass' : 'fail', `${n} 人`, { joined: Object.keys(members.body?.joined ?? {}) })

  return roomId
}

// ── L2 明文通道 ──────────────────────────────────────────────────────────────
async function stage2(roomId, a, b) {
  const send = async (from, to, tag) => {
    const txn = `${tag}${Date.now()}`
    const r = await call(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`,
      { token: from.accessToken, body: { msgtype: 'm.text', body: `${tag}:${txn}` } }
    )
    return { ...r, eventId: r.body?.event_id, text: `${tag}:${txn}` }
  }
  const a2b = await send(a, b, 'plain-a2b')
  record('L2', 'A→B 明文', a2b.status === 200 ? 'pass' : 'fail', `status=${a2b.status}`, { event_id: a2b.eventId })
  const b2a = await send(b, a, 'plain-b2a')
  record('L2', 'B→A 明文', b2a.status === 200 ? 'pass' : 'fail', `status=${b2a.status}`, { event_id: b2a.eventId })

  // 回读：确认两端都能看到对方的消息（同步/消息可见性）
  const msgs = await call('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, {
    token: a.accessToken
  })
  const bodies = (msgs.body?.chunk ?? []).filter((e) => e.type === 'm.room.message').map((e) => e.content?.body)
  const bothVisible = bodies.includes(a2b.text) && bodies.includes(b2a.text)
  record('L2', '双方消息互见', bothVisible ? 'pass' : 'fail', `可见 ${bodies.length} 条`, { bodies })
}

// ── L3 加密事件（服务端放行 + 字段完整）──────────────────────────────────────
async function stage3(roomId, a, b) {
  const mkCipher = () => ({
    algorithm: 'm.megolm.v1.aes-sha2',
    // ⚠️ 占位密文：不是真实 Megolm 输出，只用于验证服务端是否放行/存储该字段
    ciphertext: bytesB64(256),
    sender_key: bytesB64(32),
    device_id: a.deviceId,
    session_id: bytesB64(20)
  })
  const sendEnc = async (from, tag) => {
    const txn = `${tag}${Date.now()}`
    const r = await call(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.encrypted/${txn}`,
      { token: from.accessToken, body: mkCipher() }
    )
    return { ...r, eventId: r.body?.event_id }
  }
  const a2b = await sendEnc(a, 'enc-a2b')
  record('L3', 'A→B m.room.encrypted', a2b.status === 200 ? 'pass' : 'fail', `status=${a2b.status}`, a2b.body)
  const b2a = await sendEnc(b, 'enc-b2a')
  record('L3', 'B→A m.room.encrypted', b2a.status === 200 ? 'pass' : 'fail', `status=${b2a.status}`, b2a.body)

  const msgs = await call('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, {
    token: a.accessToken
  })
  const encEvents = (msgs.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
  const sample = encEvents[0]?.content
  const fieldsOk =
    Boolean(sample) &&
    sample.algorithm === 'm.megolm.v1.aes-sha2' &&
    typeof sample.ciphertext === 'string' &&
    typeof sample.session_id === 'string' &&
    typeof sample.sender_key === 'string' &&
    typeof sample.device_id === 'string'
  record(
    'L3',
    '密文字段完整回读',
    fieldsOk ? 'pass' : 'fail',
    `${encEvents.length} 条 encrypted，字段 ${fieldsOk ? '齐全' : '缺失'}`,
    sample ? { keys: Object.keys(sample), ciphertextLen: sample.ciphertext?.length } : null
  )
  record('L3', '（说明）非真实加解密', 'info', 'ciphertext 为占位串；真加解密必须在两端客户端完成')
}

// ── L4 设备密钥 ──────────────────────────────────────────────────────────────
/**
 * 构造**真实签名**的 device_keys。
 *
 * ⚠️ 第一版用随机 64 字节当签名 → 服务端返回
 * `400 M_BAD_JSON Invalid device key signature`，看起来像服务端不支持，
 * 实际是脚本伪造签名（服务端验签是对的）。另外 Matrix 用的是**标准 base64 无填充**，
 * 不是 base64url —— 用 `-_` 字母表同样会被判非法签名。
 */
const canon = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
}
const b64std = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '')

function makeEd25519() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const pub = b64std(publicKey.export({ type: 'spki', format: 'der' }).subarray(-32))
  const signJson = (obj) => b64std(sign(null, Buffer.from(canon(obj)), privateKey))
  return { pub, signJson }
}

function buildDeviceKeys(account, { curveKey, ed25519 }) {
  const unsigned = {
    algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
    device_id: account.deviceId,
    keys: {
      [`curve25519:${account.deviceId}`]: curveKey,
      [`ed25519:${account.deviceId}`]: ed25519.pub
    },
    user_id: account.userId
  }
  return { ...unsigned, signatures: { [account.userId]: { [`ed25519:${account.deviceId}`]: ed25519.signJson(unsigned) } } }
}

async function stage4(a, b, serverName) {
  const rand32 = () => b64std(Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
  const keys = { a: { curveKey: rand32(), ed25519: makeEd25519() }, b: { curveKey: rand32(), ed25519: makeEd25519() } }

  const otkUnsigned = { key: rand32() }
  const otk = {
    key: otkUnsigned.key,
    signatures: { [a.userId]: { [`ed25519:${a.deviceId}`]: keys.a.ed25519.signJson(otkUnsigned) } }
  }

  const uploadA = await call('POST', '/_matrix/client/v3/keys/upload', {
    token: a.accessToken,
    body: {
      device_keys: buildDeviceKeys(a, keys.a),
      one_time_keys: { [`signed_curve25519:AAAAAQ`]: otk }
    }
  })
  record(
    'L4',
    'A 上传 device_keys + one_time_key（真实签名）',
    uploadA.status === 200 ? 'pass' : 'fail',
    `status=${uploadA.status} counts=${JSON.stringify(uploadA.body?.one_time_key_counts ?? {})}`,
    uploadA.status === 200 ? null : uploadA.body
  )

  const uploadB = await call('POST', '/_matrix/client/v3/keys/upload', {
    token: b.accessToken,
    body: { device_keys: buildDeviceKeys(b, keys.b) }
  })
  record('L4', 'B 上传 device_keys', uploadB.status === 200 ? 'pass' : 'fail', `status=${uploadB.status}`)

  const query = await call('POST', '/_matrix/client/v3/keys/query', {
    token: a.accessToken,
    body: { device_keys: { [b.userId]: [] } }
  })
  const bDevices = query.body?.device_keys?.[b.userId] ?? {}
  const bDevice = bDevices[b.deviceId]
  record(
    'L4',
    '查询对端设备密钥',
    query.status === 200 && Boolean(bDevice) ? 'pass' : 'fail',
    `${Object.keys(bDevices).length} 个设备，目标设备${bDevice ? '存在' : '缺失'}`,
    bDevice ? { algorithms: bDevice.algorithms, keyIds: Object.keys(bDevice.keys ?? {}) } : null
  )

  const claim = await call('POST', '/_matrix/client/v3/keys/claim', {
    token: b.accessToken,
    body: { one_time_keys: { [a.userId]: { [a.deviceId]: 'signed_curve25519' } } }
  })
  const claimed = claim.body?.one_time_keys?.[a.userId]?.[a.deviceId]
  record(
    'L4',
    '领取 A 的一次性密钥（Olm 会话前提）',
    claim.status === 200 && Boolean(claimed) ? 'pass' : 'fail',
    claimed ? `keyId=${Object.keys(claimed)[0] ?? '?'}` : `status=${claim.status} 无返回`,
    claim.body
  )

  const anon = await call('POST', '/_matrix/client/v3/keys/query', { body: { device_keys: { [b.userId]: [] } } })
  record('L4', '匿名查询被拒', anon.status === 401 ? 'pass' : 'fail', `status=${anon.status}`)

  // ── 安全性：签名校验是否 fail-open（缺 signatures 的 device_keys 应被拒）
  // 实测：带**错误**签名 → 400；带**缺失**signatures → 200 且落库。
  // 说明校验只在「有 signatures 字段」时执行，属于 fail-open。
  const forged = {
    algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
    device_id: b.deviceId,
    keys: {
      [`curve25519:${b.deviceId}`]: rand32(),
      [`ed25519:${b.deviceId}`]: b64std(Buffer.from('forged'.repeat(6).slice(0, 32)))
    },
    user_id: b.userId
    // 故意不带 signatures
  }
  const forgedRes = await call('POST', '/_matrix/client/v3/keys/upload', { token: b.accessToken, body: { device_keys: forged } })
  record(
    'L4',
    '缺少 signatures 的 device_keys 应被拒绝',
    forgedRes.status === 400 ? 'pass' : 'fail',
    forgedRes.status === 400 ? '已拒绝' : `返回 ${forgedRes.status}：验签被跳过（fail-open）`,
    forgedRes.body
  )
}

// ── L5 to-device（SAS 握手通道）─────────────────────────────────────────────
async function syncOnce(account, since, timeout = 0) {
  const q = new URLSearchParams({ timeout: String(timeout) })
  if (since) q.set('since', since)
  const r = await call('GET', `/_matrix/client/v3/sync?${q}`, { token: account.accessToken })
  return r.body
}

async function drainToDevice(account, rounds = 3) {
  let since = null
  const collected = []
  for (let i = 0; i < rounds; i += 1) {
    const body = await syncOnce(account, since, i === 0 ? 0 : 1500)
    since = body?.next_batch ?? since
    for (const [sender, byType] of Object.entries(body?.to_device?.events ?? {})) {
      void sender
      void byType
    }
    const events = (body?.to_device?.events ?? []).map((e) => e)
    if (events.length) collected.push(...events)
    if (!body?.to_device?.events?.length && i > 0) break
  }
  return collected
}

async function stage5(roomId, a, b) {
  const sendToDevice = async (from, to, type, content) => {
    const txn = `${type.split('.').pop()}${Date.now()}${rand(3)}`
    return call('PUT', `/_matrix/client/v3/sendToDevice/${type}/${txn}`, {
      token: from.accessToken,
      body: { messages: { [to.userId]: { [to.deviceId]: content } } }
    })
  }
  const txId = `sas${Date.now().toString(36)}`

  const req = await sendToDevice(a, b, 'm.key.verification.request', {
    from_device: a.deviceId,
    methods: ['m.sas.v1'],
    timestamp: Date.now(),
    transaction_id: txId
  })
  record('L5', 'A→B 验证请求', req.status === 200 ? 'pass' : 'fail', `status=${req.status}`)
  const bEvents = await drainToDevice(b)
  const gotReq = bEvents.find((e) => e.type === 'm.key.verification.request')
  record(
    'L5',
    'B 收到验证请求（to-device 投递）',
    gotReq ? 'pass' : 'fail',
    gotReq ? `transaction_id=${gotReq.content?.transaction_id}` : `收到 ${bEvents.length} 条 to-device 事件`,
    gotReq?.content ?? null
  )

  const ready = await sendToDevice(b, a, 'm.key.verification.ready', {
    from_device: b.deviceId,
    methods: ['m.sas.v1'],
    transaction_id: txId
  })
  record('L5', 'B→A ready', ready.status === 200 ? 'pass' : 'fail', `status=${ready.status}`)
  const aEvents = await drainToDevice(a)
  const gotReady = aEvents.find((e) => e.type === 'm.key.verification.ready')
  record('L5', 'A 收到 ready', gotReady ? 'pass' : 'fail', gotReady ? `tx=${gotReady.content?.transaction_id}` : '未收到')

  // SAS 真正的密钥交换由客户端算：这里只验证 key/mac/done 三个信封能双向送达
  const key = await sendToDevice(a, b, 'm.key.verification.key', { transaction_id: txId, key: bytesB64(32) })
  record('L5', 'A→B key', key.status === 200 ? 'pass' : 'fail', `status=${key.status}`)
  const keySeen = (await drainToDevice(b)).find((e) => e.type === 'm.key.verification.key')
  record('L5', 'B 收到 key', keySeen ? 'pass' : 'fail', keySeen ? 'key 长度=' + (keySeen.content?.key?.length ?? 0) : '未收到')

  const mac = await sendToDevice(b, a, 'm.key.verification.mac', {
    transaction_id: txId,
    mac: { [`ed25519:${b.deviceId}`]: bytesB64(32) },
    keys: bytesB64(32)
  })
  record('L5', 'B→A mac', mac.status === 200 ? 'pass' : 'fail', `status=${mac.status}`)
  const macSeen = (await drainToDevice(a)).find((e) => e.type === 'm.key.verification.mac')
  record('L5', 'A 收到 mac', macSeen ? 'pass' : 'fail', macSeen ? 'mac 字段=' + Object.keys(macSeen.content?.mac ?? {}).join(',') : '未收到')

  const done = await sendToDevice(a, b, 'm.key.verification.done', { transaction_id: txId })
  record('L5', 'A→B done', done.status === 200 ? 'pass' : 'fail', `status=${done.status}`)

  record(
    'L5',
    '（说明）SAS 数值未比对',
    'info',
    'SAS emoji/decimal 由两端客户端从 ECDH 共享密钥派生，服务端不可见；本层只验信封通道'
  )
  return { txId }
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now()
  log(`\n== E2EE 冒烟（协议层） base=${BASE} ==\n`)
  try {
    const env = await stage0()
    const a0 = await register('a')
    const b0 = await register('b')
    // 固定 device 名，便于在客户端设备列表里识别本次跑测
    const a = await ensureDevice(a0, a0.deviceId, 'e2ee-smoke-A')
    const b = await ensureDevice(b0, b0.deviceId, 'e2ee-smoke-B')
    record('L0', '测试账号就绪', 'pass', `${a.userId}/${a.deviceId} · ${b.userId}/${b.deviceId}`)

    const roomId = await stage1(a, b)
    await stage2(roomId, a, b)
    await stage3(roomId, a, b)
    await stage4(a, b, env.roomVersions?.default ?? SERVER_NAME)
    await stage5(roomId, a, b)

    record('L9', '测试数据（可复现）', 'info', '', {
      roomId,
      accounts: [
        { userId: a.userId, password: PASSWORD, deviceId: a.deviceId },
        { userId: b.userId, password: PASSWORD, deviceId: b.deviceId }
      ]
    })
  } catch (error) {
    fatal = error instanceof Error ? error.message : String(error)
    record('XX', '流程中断', 'fail', fatal)
  }

  const summary = {
    base: BASE,
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    pass: results.filter((r) => r.level === 'pass').length,
    fail: results.filter((r) => r.level === 'fail').length,
    skip: results.filter((r) => r.level === 'skip').length,
    info: results.filter((r) => r.level === 'info').length,
    fatal,
    results
  }

  if (JSON_ONLY) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    log(`\n== 汇总：${summary.pass} passed / ${summary.fail} failed / ${summary.info} info，${(summary.durationMs / 1000).toFixed(1)}s ==`)
    if (summary.fail === 0) log('协议层全通：服务端已具备 E2EE 所需能力，剩余风险在客户端 crypto。')
  }
  process.exitCode = summary.fail === 0 ? 1 * 0 : 1
}

main().catch((error) => {
  console.error('脚本自身异常:', error)
  process.exitCode = 2
})
