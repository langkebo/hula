#!/usr/bin/env node
/**
 * D5 取证：UTD 时客户端到底会不会发房间密钥请求（m.room_key_request）。
 *
 * 背景与口径：
 *   - 用户要求「前端不自建补发」，只用 synapse-rust 侧事实判定「客户端发没发」。
 *   - 之前的判据查的是 `to_device_messages`（标准 Matrix 的 to-device 通道），
 *     但本项目的 SDK **有两条通道**：
 *       a) to-device `m.room_key_request`（标准）
 *       b) HTTP `createRoomKeyRequest` → 服务端 `e2ee_key_requests` 表
 *          （`matrix-js-sdk/lib/e2ee/index.d.ts` 注释：后端只返回 `{request_id}`）
 *     ⇒ 只查 a 会漏判。本脚本**两张表都查**。
 *
 * 代码链路（前端侧）：
 *   `useEncryption.startCryptoHealthMonitor()` → `CryptoHealthMonitor.start()`
 *     → 每 5 分钟 `performCheck()`；当 `undecryptableMessageCount > 0` 时
 *     → `triggerKeyRequests()`：遍历 timeline，找 `getContent().msgtype === 'm.bad.encrypted'`
 *     → `matrixCryptoService.createRoomKeyRequest(roomId, sessionId, ...)`
 *
 * 验证手法（不换设备、不依赖 UI）：
 *   直接向当前房间发一条**伪造的** `m.room.encrypted`（随机 session_id），
 *   客户端必然解不开 ⇒ 制造出可控 UTD；然后手工调 `performCheck()`，
 *   看 `undecryptableMessageCount` 与两张服务端表是否变化。
 *
 * 用法：node scripts/d5-key-request-probe.mjs ['!roomId']
 */

import { execFileSync } from 'node:child_process'

const CDP = `http://127.0.0.1:${process.env.CDP_PORT ?? 9222}`
const DOCKER_PG = ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc']
const results = []
const record = (name, level, detail, evidence) => {
  results.push({ name, level, detail, evidence: evidence ?? null })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function psql(sql) {
  return execFileSync('docker', [...DOCKER_PG, sql], { encoding: 'utf8', timeout: 15000 }).trim()
}

async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('tauri.localhost'))
  if (!page) throw new Error('没有 tauri WebView target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('CDP 连接失败')))
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value
  }
  return { evaluate, close: () => ws.close(), url: page.url }
}

async function main() {
  const { evaluate, close, url } = await connect()
  const roomId = process.argv[2] ?? url.match(/chatMain\/(.+)$/)?.[1]
  if (!roomId) throw new Error('拿不到 roomId，请先导航到加密房或传参')
  console.log(`\n== D5 取证  room=${roomId} ==\n`)

  const since = Date.now()
  const before = {
    toDevice: Number(psql(`select count(*) from to_device_messages where event_type like '%room_key%'`) || 0),
    http: Number(psql(`select count(*) from e2ee_key_requests`) || 0)
  }
  record('服务端基线', 'info', `to_device %room_key%=${before.toDevice} 条，e2ee_key_requests=${before.http} 条`)

  // 1) 制造可控 UTD：发一条伪造的 m.room.encrypted（随机 session_id，客户端必然解不开）
  const fakeSession = `d5probe_${Date.now()}`
  const sent = await evaluate(`
    (async () => {
      const m = await import('/src/services/matrix/index.ts');
      const c = m.matrixClientService.getClient();
      if (!c) return { ok: false, reason: 'no-client' };
      try {
        const r = await c.sendEvent(${JSON.stringify(roomId)}, 'm.room.encrypted', {
          algorithm: 'm.megolm.v1.aes-sha2',
          ciphertext: 'AwgA' + 'A'.repeat(64),
          sender_key: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          device_id: c.getDeviceId(),
          session_id: ${JSON.stringify(fakeSession)}
        });
        return { ok: true, eventId: r.event_id };
      } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
    })()
  `)
  record('伪造一条不可解密的加密事件', sent?.ok ? 'pass' : 'fail', sent?.ok ? `${sent.eventId} session=${fakeSession}` : sent?.err)
  if (!sent?.ok) {
    close()
    return finish()
  }

  // 2) 等 sync + 解密尝试
  await sleep(10000)

  const utd = await evaluate(`
    (async () => {
      const m = await import('/src/services/matrix/index.ts');
      const c = m.matrixClientService.getClient();
      const room = c?.getRoom(${JSON.stringify(roomId)});
      const evs = room?.getLiveTimeline?.()?.getEvents?.() ?? [];
      const bad = evs.filter((e) => e.isDecryptionFailure?.());
      const target = evs.find((e) => (e.getWireContent?.() || {}).session_id === ${JSON.stringify(fakeSession)});
      return {
        total: evs.length,
        utd: bad.length,
        target: target
          ? {
              type: target.getType?.(),
              isFailure: Boolean(target.isDecryptionFailure?.()),
              contentMsgtype: (target.getContent?.() || {}).msgtype,
              bodyHead: String((target.getContent?.() || {}).body || '').slice(0, 50),
              wireSessionId: (target.getWireContent?.() || {}).session_id
            }
          : null
      };
    })()
  `)
  record('客户端标记为 UTD', utd?.utd > 0 ? 'pass' : 'fail', `timeline=${utd?.total} 条，UTD=${utd?.utd} 条`, utd?.target)

  // 3) 手工触发健康检查（等价于 5 分钟定时器到点）
  const check = await evaluate(`
    (async () => {
      const mod = await import('/src/services/matrix/crypto/CryptoHealthMonitor.ts');
      const st = await mod.cryptoHealthMonitor.performCheck();
      return st;
    })()
  `).catch((e) => ({ error: String(e).slice(0, 200) }))
  record(
    'performCheck 的计数',
    Number(check?.undecryptableMessageCount) > 0 ? 'pass' : 'fail',
    `undecryptableMessageCount=${check?.undecryptableMessageCount ?? '?'}`,
    check
  )

  // 4) 直接调 createRoomKeyRequest（绕过健康检查，判断「服务端/契约」是否可用）
  const direct = await evaluate(`
    (async () => {
      const mod = await import('/src/services/matrix/crypto/MatrixCryptoService.ts');
      const svc = mod.default ?? mod.matrixCryptoService;
      try {
        await svc.createRoomKeyRequest(${JSON.stringify(roomId)}, ${JSON.stringify(fakeSession)}, 'm.megolm.v1.aes-sha2', {});
        return { ok: true };
      } catch (e) { return { ok: false, err: String(e).slice(0, 300) }; }
    })()
  `).catch((e) => ({ ok: false, err: String(e).slice(0, 200) }))
  record('直接调用 createRoomKeyRequest', direct?.ok ? 'pass' : 'fail', direct?.ok ? '请求已发出' : direct?.err)
  await sleep(4000)

  // 5) 服务端事实：两张表都查
  const after = {
    toDevice: Number(psql(`select count(*) from to_device_messages where event_type like '%room_key%'`) || 0),
    http: Number(psql(`select count(*) from e2ee_key_requests`) || 0),
    recent: psql(
      `select count(*) from e2ee_key_requests where created_ts >= ${since}`
    )
  }
  record(
    '服务端 e2ee_key_requests 新增',
    Number(after.recent) > 0 ? 'pass' : 'fail',
    `总数 ${before.http} → ${after.http}（本次 +${after.recent}）`
  )
  record(
    '服务端 to_device %room_key% 新增',
    after.toDevice > before.toDevice ? 'pass' : 'info',
    `${before.toDevice} → ${after.toDevice}（本项目走 HTTP 通道时这里不会变）`
  )

  // 6) 明细（便于确认是不是本次的 session）
  const rows = psql(
    `select request_id||' | '||device_id||' | '||session_id||' | '||action||' | '||created_ts from e2ee_key_requests where created_ts >= ${since} order by created_ts desc limit 3`
  )
  record('本次写入的请求明细', rows ? 'info' : 'info', rows || '(无)', { sample: rows })

  close()
  finish()
}

function finish() {
  const pass = results.filter((r) => r.level === 'pass').length
  const fail = results.filter((r) => r.level === 'fail').length
  console.log(`\n== 汇总：${pass} passed / ${fail} failed ==`)
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exitCode = 2
})
