#!/usr/bin/env node
/**
 * B6 的**设备端**判据：新房间在**不重启 App** 的前提下出现在会话列表。
 *
 * 为什么单独成脚本：B6 的根因是服务端 sliding sync **增量不物化房间**
 * （`sliding_sync_service/mod.rs:426` 只在 `is_initial` 时 `materialize_room_from_activity`），
 * REST 增量探针只能证明「ops 带 room_id」，证明不了「客户端列表真的刷新了」。
 * 用户可见的判据是：A 建房邀请 B，B 那边**不重启**就能看到。
 *
 * 判据两层：
 *   ① B 侧客户端 `getRooms()` 在 30s 内出现该 roomId（增量落库 + 会话列表刷新）
 *   ② A 在房内发消息后，B 侧该房的 lastMessage 在 10s 内更新（不再需要重启）
 *
 * 用法：
 *   E2EE_BASE=http://127.0.0.1:8008 \
 *   ADB_SERIAL_A=emulator-5554 CDP_A=9222 ADB_SERIAL_B=emulator-5556 CDP_B=9224 \
 *   node scripts/room-appear-live-probe.mjs
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { guardApkFreshness, resetAppState } from './lib/probe-runtime.mjs'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const ANDROID_HOME = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
const ADB =
  [process.env.ADB, `${ANDROID_HOME}/platform-tools/adb`, 'adb'].find((p) => p && (p === 'adb' || existsSync(p))) ?? 'adb'
const DEV_A = { serial: process.env.ADB_SERIAL_A ?? 'emulator-5554', cdp: Number(process.env.CDP_A ?? 9222) }
const DEV_B = { serial: process.env.ADB_SERIAL_B ?? 'emulator-5556', cdp: Number(process.env.CDP_B ?? 9224) }
const APPEAR_TIMEOUT = Number(process.env.APPEAR_TIMEOUT ?? 30000)
const MESSAGE_TIMEOUT = Number(process.env.MESSAGE_TIMEOUT ?? 10000)

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 380))
}

const adb = (serial, args) => {
  try {
    return execFileSync(ADB, ['-s', serial, ...args], { encoding: 'utf8', timeout: 30000 }).trim()
  } catch (e) {
    return `ERR ${String(e.message ?? e).slice(0, 80)}`
  }
}

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
  const username = `rap${label}${Date.now().toString(36)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, password: PASSWORD, userId: r.body.user_id, token: r.body.access_token }
    if (r.status === 429) {
      await sleep(1200)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 120)}`)
  }
  throw new Error('register 限流')
}

async function openCdp(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error(`:${port} 没有 WebView target`)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
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
  return { evaluate, close: () => ws.close() }
}

async function startApp(dev) {
  const hostPort = new URL(BASE).port || '80'
  adb(dev.serial, ['reverse', 'tcp:5210', 'tcp:5210'])
  adb(dev.serial, ['reverse', 'tcp:8008', `tcp:${hostPort}`])
  adb(dev.serial, ['forward', '--remove', `tcp:${dev.cdp}`])
  adb(dev.serial, ['shell', 'am', 'force-stop', 'com.tjg.app'])
  await sleep(1500)
  adb(dev.serial, ['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])
  await sleep(5000)

  let pid = null
  for (let i = 0; i < 40; i += 1) {
    const out = adb(dev.serial, ['shell', 'pidof', 'com.tjg.app'])
    if (/^\d+/.test(out)) {
      pid = out.split(/\s+/)[0]
      break
    }
    await sleep(1000)
  }
  if (!pid) throw new Error(`${dev.serial} 进程未起来`)

  adb(dev.serial, ['forward', `tcp:${dev.cdp}`, `localabstract:webview_devtools_remote_${pid}`])
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${dev.cdp}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      if (list.some((t) => t.type === 'page')) return pid
    } catch {
      /* wait */
    }
    await sleep(1000)
  }
  throw new Error(`${dev.serial} CDP target 未出现`)
}

async function passUnlock(cdp) {
  for (let i = 0; i < 20; i += 1) {
    const has = await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`).catch(() => false)
    if (!has) return false
    await cdp.evaluate(`
      (() => {
        const el = [...document.querySelectorAll('input')].find((i) => i.type === 'password' || !i.type);
        if (!el) return false;
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(el, ${JSON.stringify(UNLOCK_PW)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()
    `)
    await sleep(400)
    await cdp.evaluate(`
      (() => { const b = [...document.querySelectorAll('button, .van-dialog__confirm')].find((x) => /^解锁$/.test((x.innerText || '').trim())); b?.click(); return true })()
    `)
    await sleep(3000)
  }
  return false
}

const uidOf = (cdp) =>
  cdp
    .evaluate(`
    (async () => {
      try {
        const m = await import('/src/services/matrix/index.ts');
        return m.matrixClientService.getClient()?.getUserId?.() ?? null;
      } catch { return null; }
    })()
  `)
    .catch(() => null)

async function loginApp(cdp, account) {
  for (let i = 0; i < 40; i += 1) {
    const unlockNow = await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`).catch(() => false)
    if (unlockNow) {
      await passUnlock(cdp)
      await sleep(2000)
      continue
    }
    const n = await cdp.evaluate('document.querySelectorAll("input").length').catch(() => 0)
    if (Number(n) >= 3) break
    if (i === 8) {
      await cdp.evaluate(`
        (() => { document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router?.push({ name: 'mobileLogin' }).catch(() => {}); return true })()
      `)
    }
    await sleep(1000)
  }
  const filled = await cdp.evaluate(`
    (() => {
      const s = (el, v) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll('input')];
      const byPh = (ph) => inputs.find((i) => (i.placeholder || '').includes(ph));
      const server = byPh('服务器地址');
      const account = byPh('账号');
      const pwd = inputs.find((i) => i.type === 'password');
      if (!account || !pwd) return { ok: false, ph: inputs.map((i) => i.placeholder) };
      if (server) s(server, ${JSON.stringify(BASE)});
      s(account, ${JSON.stringify(account.username)});
      s(pwd, ${JSON.stringify(account.password)});
      return { ok: true };
    })()
  `)
  if (!filled?.ok) return { ok: false, reason: `填表失败 ${JSON.stringify(filled)}` }
  await sleep(600)
  await cdp.evaluate(`
    (() => { const b = [...document.querySelectorAll('button, .van-button')].find((x) => (x.innerText || '').trim() === '登录'); b?.click(); return true })()
  `)
  for (let i = 0; i < 45; i += 1) {
    await sleep(1000)
    const uid = await uidOf(cdp)
    if (uid && (!account?.userId || uid === account.userId)) return { ok: true }
  }
  return { ok: false, reason: '登录后仍未切到目标账号' }
}

/** 客户端当前已知的房间（含 invite；`getRooms()` 是会话列表的数据源） */
const roomIdsOf = (cdp) =>
  cdp
    .evaluate(`
    (async () => {
      try {
        const m = await import('/src/services/matrix/index.ts');
        const client = m.matrixClientService.getClient?.() ?? null;
        if (!client) return null;
        return (client.getRooms?.() ?? []).map((r) => r.roomId);
      } catch { return null; }
    })()
  `)
    .catch(() => null)

/** 某房间在客户端侧的最后一条消息正文 */
const lastBodyOf = (cdp, roomId) =>
  cdp
    .evaluate(`
    (async () => {
      try {
        const m = await import('/src/services/matrix/index.ts');
        const room = m.matrixClientService.getClient?.()?.getRoom(${JSON.stringify(roomId)}) ?? null;
        if (!room) return null;
        const ev = room.timeline?.[room.timeline.length - 1] ?? null;
        return ev?.getContent?.()?.body ?? null;
      } catch { return null; }
    })()
  `)
    .catch(() => null)

async function main() {
  console.log(`后端=${BASE}  A=${DEV_A.serial}  B=${DEV_B.serial}\n`)
  guardApkFreshness()
  // 两台都清：上一支探针残留的登录态会让「填表」找不到登录表单
  resetAppState(ADB, DEV_A.serial)
  resetAppState(ADB, DEV_B.serial)
  const a = await register('a')
  const b = await register('b')
  console.log(`A=${a.userId}\nB=${b.userId}\n`)

  const pidA = await startApp(DEV_A)
  const cdpA = await openCdp(DEV_A.cdp)
  record('S0', '设备 A 启动 + CDP 就绪', 'pass', `pid=${pidA}，cdp=:${DEV_A.cdp}`)

  const pidB = await startApp(DEV_B)
  const cdpB = await openCdp(DEV_B.cdp)
  record('S0', '设备 B 启动 + CDP 就绪', 'pass', `pid=${pidB}，cdp=:${DEV_B.cdp}`)

  const lgA = await loginApp(cdpA, a)
  record('S0', '设备 A 登录', lgA.ok ? 'pass' : 'fail', lgA.ok ? a.userId : lgA.reason)
  const lgB = await loginApp(cdpB, b)
  record('S0', '设备 B 登录', lgB.ok ? 'pass' : 'fail', lgB.ok ? b.userId : lgB.reason)
  if (!lgA.ok || !lgB.ok) throw new Error('登录失败，后续判据无法取证')

  const before = (await roomIdsOf(cdpB)) ?? []
  record('B6', 'B 侧基线会话数', 'info', `${before.length} 个房间`)

  // ① A 建房并邀请 B —— B 侧**不重启**应出现
  const created = await rest('POST', '/_matrix/client/v3/createRoom', {
    token: a.token,
    body: { name: `appear-${Date.now().toString(36)}`, preset: 'private_chat', invite: [b.userId] }
  })
  const roomId = created.body?.room_id ?? null
  record('B6', 'A 建房并邀请 B（REST）', created.status === 200 && roomId ? 'pass' : 'fail', `status=${created.status}，room=${roomId}`)
  if (!roomId) throw new Error('建房失败，无法继续')

  const t0 = Date.now()
  let appearedMs = null
  while (Date.now() - t0 < APPEAR_TIMEOUT) {
    const ids = (await roomIdsOf(cdpB)) ?? []
    if (ids.includes(roomId)) {
      appearedMs = Date.now() - t0
      break
    }
    await sleep(1000)
  }
  record(
    'B6',
    'B 侧不重启即出现该会话',
    appearedMs !== null ? 'pass' : 'fail',
    appearedMs !== null ? `${appearedMs}ms（判据 <${APPEAR_TIMEOUT}ms）` : `超时 ${APPEAR_TIMEOUT}ms 仍未出现`,
    { baseline: before.length, target: roomId, now: await roomIdsOf(cdpB) }
  )

  // ② A 发消息 → B 侧该房最后一条内容更新（仍然不重启）
  const body = `appear-msg-${Date.now().toString(36)}`
  const sent = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
    token: a.token,
    body: { msgtype: 'm.text', body }
  })
  record('B6', 'A 在房内发消息', sent.status === 200 ? 'pass' : 'fail', `status=${sent.status}，event=${sent.body?.event_id}`)

  const t1 = Date.now()
  let msgMs = null
  while (Date.now() - t1 < MESSAGE_TIMEOUT) {
    const last = await lastBodyOf(cdpB, roomId)
    if (last === body) {
      msgMs = Date.now() - t1
      break
    }
    await sleep(1000)
  }
  record(
    'B6',
    'B 侧不重启即收到该消息',
    msgMs !== null ? 'pass' : 'fail',
    msgMs !== null ? `${msgMs}ms（判据 <${MESSAGE_TIMEOUT}ms）` : `超时 ${MESSAGE_TIMEOUT}ms，最后一条=${await lastBodyOf(cdpB, roomId)}`
  )

  cdpA.close()
  cdpB.close()

  const pass = results.filter((r) => r.level === 'pass').length
  const fail = results.filter((r) => r.level === 'fail').length
  const skip = results.filter((r) => r.level === 'skip').length
  console.log(`\n== 汇总：${pass} passed / ${fail} failed / ${skip} skip ==`)
  process.exitCode = fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exitCode = 2
})
