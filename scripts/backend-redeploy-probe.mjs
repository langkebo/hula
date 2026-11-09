#!/usr/bin/env node
/**
 * 后端重部署后的 HTTP/DB 层复核（不依赖前端渲染）。
 *
 * 只覆盖「服务端事实」这一层，用于把「后端有没有变」与「前端/SDK 有没有变」分开：
 *  - A1 capabilities 房间版本清单（D15 复核：是否仍只有 v12 can_create）
 *  - A2 BE-12：6000B 正文写入 200；好友 >33 个仍可 accept（不再 500）
 *  - A3 BE-9：410 响应形状（{errcode,error} 统一信封）
 *  - A4 D4：不带 signatures 的 device_keys 上传是否仍被接受（fail-open 与否）
 *  - A5 D5：`e2ee_key_requests` 行数（前端是否仍在发请求）
 *  - A6 D16：`/notifications` 是否产生记录（含提及）
 *  - A7 D17：burn 设置 was per-user 复核（B 未开启时标记应 400）
 *
 * 用法：node scripts/backend-redeploy-probe.mjs
 */
import { execFileSync } from 'node:child_process'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PW = 'Redeploy!probe9x8y7z'
const results = []
const rec = (id, name, level, detail, evidence) => {
  results.push({ id, name, level, detail })
  const tag = { pass: '✅', fail: '❌', info: 'ℹ️' }[level] ?? '·'
  console.log(`${tag} [${id}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 400))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    /* raw */
  }
  return { status: res.status, body: parsed, raw: text }
}

async function register(label) {
  const username = `rd${label}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PW, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, userId: r.body.user_id, token: r.body.access_token }
    if (r.status === 429) {
      await sleep(1500)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 120)}`)
  }
  throw new Error('register 限流')
}

const psql = (sql) => {
  try {
    return execFileSync('docker', ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql], {
      encoding: 'utf8',
      timeout: 20000
    }).trim()
  } catch (e) {
    return `ERR ${String(e.message ?? e).slice(0, 120)}`
  }
}

async function main() {
  const a = await register('a')
  const b = await register('b')
  console.log(`A=${a.userId}\nB=${b.userId}\n`)

  // ── A1 capabilities
  const cap = await rest('GET', '/_matrix/client/v3/capabilities', { token: a.token })
  const versions = cap.body?.capabilities?.['m.room_versions'] ?? {}
  const available = versions.available ?? {}
  const creatable = Object.entries(available)
    .filter(([, v]) => v === 'stable' || v === 'unstable')
    .map(([k]) => k)
  rec(
    'A1',
    'capabilities 房间版本',
    'info',
    `default=${versions.default}，available=${Object.keys(available).length} 个，can_create 候选=${creatable.join(',') || '无'}`,
    versions
  )

  // ── A2 BE-12：大正文 + 好友上限
  const room = await rest('POST', '/_matrix/client/v3/createRoom', {
    token: a.token,
    body: { name: `rd-${Date.now().toString(36)}`, preset: 'private_chat' }
  })
  const roomId = room.body?.room_id
  rec('A2', '建房', roomId ? 'pass' : 'fail', roomId ?? `status=${room.status}`, room.body)

  const big = 'x'.repeat(6000)
  const sent = await rest(
    'PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`,
    {
      token: a.token,
      body: { msgtype: 'm.text', body: big }
    }
  )
  rec('A2', 'BE-12 复核：6000B 正文写入', sent.status === 200 ? 'pass' : 'fail', `status=${sent.status}`, sent.body)

  // 好友上限：34 个好友依次 accept（旧缺陷：friend list 事件过大 ⇒ 500）
  let acceptFail = null
  for (let i = 0; i < 34; i += 1) {
    const u = await register(`f${i}`)
    await rest('POST', `/_matrix/vendor/v1/friends/request`, { token: a.token, body: { user_id: u.userId } })
    const acc = await rest('POST', `/_matrix/vendor/v1/friends/request/${encodeURIComponent(a.userId)}/accept`, {
      token: u.token
    })
    if (acc.status !== 200) {
      acceptFail = { i, status: acc.status, body: acc.body }
      break
    }
  }
  rec(
    'A2',
    'BE-12 复核：34 个好友 accept',
    acceptFail ? 'fail' : 'pass',
    acceptFail ? `第 ${acceptFail.i} 个失败：${acceptFail.status}` : '34/34 200',
    acceptFail
  )

  // ── A3 BE-9：410 形状（用不存在的房间 join 触发 404/410 类错误，检查是否统一信封）
  const gone = await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent('!nonexistent:matrix.test')}`, {
    token: a.token,
    body: {}
  })
  rec(
    'A3',
    'BE-9 复核：错误体形状',
    gone.body && typeof gone.body === 'object' && 'errcode' in gone.body && 'error' in gone.body ? 'pass' : 'fail',
    `status=${gone.status} keys=${Object.keys(gone.body ?? {}).join(',')}`,
    gone.raw.slice(0, 200)
  )

  // ── A4 D4：无 signatures 的 device_keys
  const deviceId = `RDPROBE${Date.now().toString(36).slice(-6)}`
  const keys = {
    user_id: a.userId,
    device_id: deviceId,
    algorithms: ['m.olm.v1.curve25519-aes-sha2', 'm.megolm.v1.aes-sha2'],
    keys: { [`curve25519:${deviceId}`]: 'curve25519keyprobe', [`ed25519:${deviceId}`]: 'ed25519keyprobe' }
  }
  const noSig = await rest('POST', '/_matrix/client/v3/keys/upload', {
    token: a.token,
    body: { device_keys: keys }
  })
  rec(
    'A4',
    'D4 复核：无 signatures 的 device_keys',
    noSig.status === 200 ? 'fail' : 'pass',
    `status=${noSig.status}（200 ⇒ 仍 fail-open）`,
    noSig.body
  )
  const badSig = await rest('POST', '/_matrix/client/v3/keys/upload', {
    token: a.token,
    body: { device_keys: { ...keys, signatures: { [a.userId]: { [`ed25519:${deviceId}`]: 'deadbeef' } } } }
  })
  rec('A4', 'D4 对照：错签名必须拒绝', badSig.status >= 400 ? 'pass' : 'fail', `status=${badSig.status}`, badSig.body)

  // ── A5 D5：key request 行数（表存在则统计最近 10 分钟）
  const kr = psql('select count(*) from e2ee_key_requests where created_ts > (extract(epoch from now())*1000 - 600000)')
  rec('A5', 'D5 复核：e2ee_key_requests 近 10 分钟行数', 'info', `rows=${kr}`)
  // 载荷是**扁平**的（SDK `RoomKeysManager.createRoomKeyRequest` 实测：algorithm/room_id/session_id 必填）
  const created = await rest('POST', '/_matrix/client/v3/room_keys/request', {
    token: a.token,
    body: { algorithm: 'm.megolm.v1.aes-sha2', room_id: roomId, session_id: `probeSession${Date.now()}` }
  })
  const requestId = created.body?.request_id
  rec(
    'A5',
    'D5：POST /room_keys/request',
    created.status === 200 && requestId ? 'pass' : 'fail',
    `status=${created.status}，id=${requestId ?? 'null'}`,
    created.body
  )

  // 是否存在「兑现并转发密钥」的端点（D5 的核心缺口）
  const fulfillTry = requestId
    ? await rest('POST', `/_matrix/client/v3/room_keys/request/${encodeURIComponent(requestId)}/fulfill`, {
        token: b.token,
        body: { session_key: 'probe', sender_key: 'probe', first_known_index: 0 }
      })
    : null
  rec(
    'A5',
    'D5 负向：他人不可兑现（应为 403/404）',
    fulfillTry && fulfillTry.status >= 400 ? 'pass' : 'fail',
    `status=${fulfillTry?.status ?? 'n/a'}（200 ⇒ 越权兑现）`,
    fulfillTry?.body
  )

  // 正向：本人**另一台设备**兑现（D5 的核心能力；旧镜像此端点根本不存在 → 404）
  const fulfillDeviceId = `RDF${Date.now().toString(36).slice(-5).toUpperCase()}`
  const login2 = await rest('POST', '/_matrix/client/v3/login', {
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: a.username },
      password: PW,
      device_id: fulfillDeviceId,
      initial_device_display_name: 'redeploy-probe-fulfill'
    }
  })
  const token2 = login2.body?.access_token
  const fulfill2 =
    requestId && token2
      ? await rest('POST', `/_matrix/client/v3/room_keys/request/${encodeURIComponent(requestId)}/fulfill`, {
          token: token2,
          body: { session_key: 'probeSessionKey', sender_key: 'probeSenderKey', first_known_index: 0 }
        })
      : null
  rec(
    'A5',
    'D5 正向：本人另一设备兑现',
    fulfill2 && fulfill2.status < 400 ? 'pass' : 'fail',
    `login2=${login2.status}，fulfill=${fulfill2?.status ?? 'n/a'}`,
    fulfill2?.body
  )
  const fulfilledRow = requestId
    ? psql(
        `select is_fulfilled, coalesce(fulfilled_by_device,'-') from e2ee_key_requests where request_id = '${requestId}'`
      )
    : ''
  rec(
    'A5',
    'D5：DB 落库（is_fulfilled | fulfilled_by_device）',
    /^t\|/m.test(fulfilledRow) ? 'pass' : 'fail',
    `row=${fulfilledRow}`,
    { fulfilledRow }
  )

  // ── A6 D16：通知（含提及）
  await rest('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, {
    token: a.token,
    body: { user_id: b.userId }
  })
  await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
  const disp = `Mention${Date.now().toString(36).slice(-4)}`
  await rest('PUT', '/_matrix/client/v3/profile/displayname', { token: b.token, body: { displayname: disp } })
  await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
    token: a.token,
    body: { msgtype: 'm.text', body: `${disp}: 提及测试` }
  })
  await sleep(1500)
  const notif = await rest('GET', '/_matrix/client/v3/notifications', { token: b.token })
  const count = notif.body?.notifications?.length ?? -1
  rec('A6', 'D16 复核：/notifications（含提及）', count > 0 ? 'pass' : 'fail', `count=${count}`, notif.body)

  // ⚠️ ack 的路径参数是 **notification_id**（不是 event_id）；用 event_id 会 400 M_INVALID_PARAM
  const notifId = notif.body?.notifications?.[0]?.notification_id ?? null
  if (notifId) {
    const ack = await rest('POST', `/_matrix/client/v3/notifications/${encodeURIComponent(notifId)}/ack`, {
      token: b.token,
      body: {}
    })
    const after = await rest('GET', '/_matrix/client/v3/notifications', { token: b.token })
    const afterCount = after.body?.notifications?.length ?? -1
    const readFlag = after.body?.notifications?.find((n) => n.notification_id === notifId)?.read
    rec(
      'A6',
      'D16 ack 生效（该项 read=true）',
      ack.status < 400 && readFlag === true ? 'pass' : 'fail',
      `ack=${ack.status}（is_read=${ack.body?.is_read}），列表仍返回 ${afterCount} 条、read=${readFlag}` +
        `（**ack 不会把条目从列表移除**，前端要按 read 过滤或用计数接口）`,
      { ack: ack.body, after: after.body }
    )
  } else {
    rec('A6', 'D16 ack 后计数归零', 'info', '通知体里取不到 event_id，跳过 ack')
  }

  // ── A7 D17：burn 是否仍按 per-user
  const burnA = await rest('PUT', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn`, {
    token: a.token,
    body: { enabled: true, burn_after_ms: 5000 }
  })
  const msg = await rest(
    'PUT',
    `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`,
    {
      token: a.token,
      body: { msgtype: 'm.text', body: 'burn-target' }
    }
  )
  const eventId = msg.body?.event_id
  const burnPath = (base) => `${base}/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(eventId)}`
  let markB = await rest('POST', burnPath('/_matrix/client/v1'), { token: b.token, body: {} })
  if (markB.status === 404) {
    markB = await rest('POST', burnPath('/_matrix/vendor/v1'), { token: b.token, body: {} })
  }
  rec(
    'A7',
    'D17 复核：A 开启 / B 标记同房消息',
    markB.status === 400 ? 'pass' : 'fail',
    `A enable=${burnA.status}，B mark=${markB.status}（400 ⇒ 仍 per-user）`,
    markB.body
  )

  // ── A9：device_id 命名空间（Matrix 规范：device_id 是**按用户**唯一，不同用户可同名）
  const sharedDevice = `SHARED${Date.now().toString(36).slice(-4).toUpperCase()}`
  const ra = await rest('POST', '/_matrix/client/v3/login', {
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: a.username },
      password: PW,
      device_id: sharedDevice
    }
  })
  const rb = await rest('POST', '/_matrix/client/v3/login', {
    body: {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: b.username },
      password: PW,
      device_id: sharedDevice
    }
  })
  rec(
    'A9',
    '跨用户同 device_id 登录（规范应允许）',
    ra.status === 200 && rb.status === 200 ? 'pass' : 'fail',
    `A=${ra.status}，B=${rb.status}${rb.body?.error ? `（${rb.body.error}）` : ''}`,
    rb.body
  )

  // ── 汇总
  const pass = results.filter((r) => r.level === 'pass').length
  const fail = results.filter((r) => r.level === 'fail').length
  console.log(`\n== 汇总：${pass} passed / ${fail} failed / ${results.length - pass - fail} info ==`)
  process.exitCode = fail > 0 ? 1 : 0
}

main().catch((e) => {
  console.error('probe crashed:', e)
  process.exit(2)
})
