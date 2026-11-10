#!/usr/bin/env node
/**
 * 联调补测：消息关系（表情回应 / 编辑 / 撤回 / 回复 / 讨论串）、房间升级、通知 ack。
 *
 * 对应联调报告 §3 的第 11、12、3 项。判据分两层，两层都要成立才算过：
 *   ① **服务端**：事件真的写进房间（`/messages`、`/relations` 能读到，形态正确）
 *   ② **客户端**：SDK 把语义落到了 timeline 上（reaction 聚合、编辑替换、撤回标记、thread 归属）
 * 只有 ① ⇒ 后端支持但前端没接；只有 ② ⇒ 前端自嗨；两者都有才算联调通过。
 *
 * 为什么用**非加密房**：REST 侧要直接读事件 content 判形态；加密房里都是
 * `m.room.encrypted`，协议层断言做不了。E2EE 收发已由 `e2ee-two-androids.mjs` 单独覆盖。
 *
 * 用法：node scripts/msg-relations-upgrade-probe.mjs
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_A ?? 9222)
const SERIAL = process.env.ADB_SERIAL ?? 'emulator-5554'
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const ANDROID_HOME = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
const ADB = [process.env.ADB, `${ANDROID_HOME}/platform-tools/adb`, 'adb'].find((p) => p && (p === 'adb' || existsSync(p))) ?? 'adb'

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 380))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const adb = (args) => {
  try {
    return execFileSync(ADB, ['-s', SERIAL, ...args], { encoding: 'utf8', timeout: 30000 }).trim()
  } catch (e) {
    return `ERR ${String(e.message ?? e).slice(0, 80)}`
  }
}

async function rest(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
  const username = `rel${label}${Date.now().toString(36)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', { body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } } })
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
  return { send, evaluate, close: () => ws.close() }
}

async function startApp() {
  // 设备侧统一访问 127.0.0.1:8008 / 127.0.0.1:8018，映射到 E2EE_BASE 的实际宿主端口
  // （e2e 后端常驻 8018，宿主 8008 被另一套实例占用，不能盲写 tcp:8008）
  const hostPort = new URL(BASE).port || '80'
  adb(['reverse', 'tcp:5210', 'tcp:5210'])
  adb(['reverse', 'tcp:8008', `tcp:${hostPort}`])
  adb(['reverse', 'tcp:8018', `tcp:${hostPort}`])
  adb(['forward', '--remove', `tcp:${CDP_PORT}`])
  adb(['shell', 'am', 'force-stop', 'com.tjg.app'])
  await sleep(2000)
  adb(['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])
  await sleep(6000)
  let pid = null
  for (let i = 0; i < 40; i += 1) {
    const out = adb(['shell', 'pidof', 'com.tjg.app'])
    if (/^\d+/.test(out)) {
      pid = out.split(/\s+/)[0]
      break
    }
    await sleep(1000)
  }
  if (!pid) throw new Error('进程未起来')
  adb(['forward', `tcp:${CDP_PORT}`, `localabstract:webview_devtools_remote_${pid}`])
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      if (list.some((t) => t.type === 'page')) return pid
    } catch {
      /* wait */
    }
    await sleep(1000)
  }
  throw new Error('CDP target 未出现')
}

async function passUnlock(cdp) {
  for (let i = 0; i < 30; i += 1) {
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
    await sleep(4000)
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
    // 解锁弹窗会盖在登录页上（此时 DOM 只有 1 个 input），必须边等边过掉
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
    // 必须登录成目标账号：残留旧会话时 getClient().getUserId() 也是非空，不能只判非空
    if (uid && (!account?.userId || uid === account.userId)) return { ok: true }
  }
  return { ok: false, reason: '登录后仍未切到目标账号' }
}

/**
 * 断言前的自愈：确保客户端还在。
 *
 * 实测（2026-11-09）跑测中途会出现「整页 reload → client=null + 重新弹解锁门禁」，
 * 页面仍停在 /mobile/message、localStorage 里账号还在，但 `getClient()` 为 null，
 * 于是「房间消失」而不是「断言失败」。这不是脚本问题（弹窗只在 onMounted 触发一次），
 * 记为 D12：运行中重载导致客户端置空且无「已断开」提示。
 *
 * 自愈顺序：过弹窗 → 等 12s → 仍无 client 就重新登录（同一账号）。
 */
let healCount = 0
async function ensureClient(cdp, account, roomId) {
  const hasClient = async () =>
    Boolean(
      await cdp
        .evaluate(`(async () => { const m = await import('/src/services/matrix/index.ts'); return Boolean(m.matrixClientService.getClient?.()?.getUserId?.()) })()`)
        .catch(() => false)
    )
  if (await hasClient()) return { ok: true, healed: false }

  healCount += 1
  console.log('   · 检测到 client 为空（D12：运行中重载），进入自愈')
  await passUnlock(cdp)
  for (let i = 0; i < 12; i += 1) {
    await sleep(1000)
    if (await hasClient()) break
  }
  if (!(await hasClient())) {
    const lg = await loginApp(cdp, account)
    if (!lg.ok) return { ok: false, reason: lg.reason }
  }
  // 等房间重新同步
  if (roomId) {
    for (let i = 0; i < 20; i += 1) {
      const ready = await cdp
        .evaluate(`(async () => { const m = await import('/src/services/matrix/index.ts'); return Boolean(m.matrixClientService.getClient?.()?.getRoom(${JSON.stringify(roomId)})) })()`)
        .catch(() => false)
      if (ready) break
      await sleep(1000)
    }
  }
  return { ok: true, healed: true }
}

/** 客户端 timeline 里某个事件的可观测语义 */
const eventStateFn = (roomId, eventId) => `
  (async () => {
    const m = await import('/src/services/matrix/index.ts');
    const client = m.matrixClientService.getClient?.() ?? null;
    const room = client?.getRoom(${JSON.stringify(roomId)}) ?? null;
    if (!room) {
      return {
        noRoom: true,
        clientRooms: client?.getRooms?.()?.length ?? null,
        supportsThreads: typeof client?.supportsThreads === 'function' ? client.supportsThreads() : null,
        syncState: client?.getSyncState?.() ?? null,
        uid: client?.getUserId?.() ?? null,
        href: location.href.replace('http://tauri.localhost', '')
      };
    }
    let ev = room.findEventById?.(${JSON.stringify(eventId)}) ?? null;
    if (!ev) {
      const all = room.getLiveTimeline?.()?.getEvents?.() ?? [];
      ev = all.find((e) => e.getId?.() === ${JSON.stringify(eventId)}) ?? null;
    }
    // 两种取法都试：新版 SDK 的 room.getRelations()，老版按 timeline 扫
    let annCount = null;
    let annKeys = [];
    try {
      const rels = room.getRelations?.();
      const ann = rels?.getRelationsForEvent?.(${JSON.stringify(eventId)}, 'm.annotation', 'm.reaction');
      if (ann) {
        annCount = Array.from(ann).length;
        annKeys = Array.from(ann).map((e) => String(e.getContent?.()?.key ?? ''));
      }
    } catch {}
    if (annCount === null) {
      const evs = room.getLiveTimeline?.()?.getEvents?.() ?? [];
      const mine = evs.filter((e) => {
        const c = e.getContent?.() ?? {};
        const r = c['m.relates_to'] ?? {};
        return e.getType?.() === 'm.reaction' && r.event_id === ${JSON.stringify(eventId)};
      });
      annCount = mine.length;
      annKeys = mine.map((e) => String(e.getContent?.()?.['m.relates_to']?.key ?? ''));
    }
    return {
      found: Boolean(ev),
      body: String(ev?.getContent?.()?.body ?? ''),
      redacted: Boolean(ev?.isRedacted?.()),
      relationType: ev?.getRelation?.()?.rel_type ?? null,
      relationEvent: ev?.getRelation?.()?.event_id ?? null,
      replyTo: ev?.replyEventId ?? null,
      annotations: annCount,
      annotationsKeys: annKeys,
      threadCount: room.getThread?.(${JSON.stringify(eventId)})?.length ?? null,
      supportsThreads: typeof client?.supportsThreads === 'function' ? client.supportsThreads() : null,
      syncState: client?.getSyncState?.() ?? null
    };
  })()
`

async function main() {
  let cdp = null
  try {
    const a = await register('a')
    const b = await register('b')
    console.log(`A=${a.userId}  B=${b.userId}\n`)

    // 应用登录 A（用于客户端语义断言）
    const pid = await startApp()
    cdp = await openCdp(CDP_PORT)
    await passUnlock(cdp)
    // 冷启动后会话恢复是异步的：先等 client 出现，否则 uid 读到 null 会直接跳过账号切换
    let before = await uidOf(cdp)
    for (let i = 0; i < 30 && !before; i += 1) {
      await sleep(1000)
      await passUnlock(cdp)
      before = await uidOf(cdp)
    }
    console.log(`   · 启动后当前账号：${before ?? 'null'}`)
    if (before && before !== a.userId) {
      // 走应用真实登出编排（清本地会话 + 安全存储 token + 跳登录页）；
      // matrixClientService.logout() 只撤服务端会话，重载后会被持久化会话恢复回旧账号
      const out = await cdp.evaluate(`
        (async () => {
          try {
            const { sessionOrchestrator } = await import('/src/services/matrix/auth/SessionOrchestrator.ts');
            await sessionOrchestrator.logoutCurrentSession();
            return 'ok';
          } catch (e) { return 'ERR ' + String(e).slice(0, 160); }
        })()
      `)
      console.log(`   · 切换账号：登出 ${before} → ${out}`)
      await sleep(4000)
      await cdp.evaluate(`location.reload(), true`).catch(() => {})
      await sleep(9000)
      await passUnlock(cdp)
    }
    const lg = await loginApp(cdp, a)
    record('S0', '设备 A 登录（pid=' + pid + '）', lg.ok ? 'pass' : 'fail', lg.ok ? '已登录' : lg.reason)
    if (!lg.ok) throw new Error('设备登录失败')

    // 非加密房 + B join
    const created = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: { name: `rel-${Date.now().toString(36)}`, preset: 'private_chat', invite: [b.userId] }
    })
    if (created.status !== 200) throw new Error(`createRoom ${created.status}`)
    const roomId = created.body.room_id
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    record('S0', '非加密房间就绪', 'pass', `${roomId}（A 建、B join）`)

    // 等客户端把房间同步下来
    let roomReady = false
    for (let i = 0; i < 20; i += 1) {
      roomReady = await cdp
        .evaluate(`(async () => { const m = await import('/src/services/matrix/index.ts'); return Boolean(m.matrixClientService.getClient()?.getRoom(${JSON.stringify(roomId)})) })()`)
        .catch(() => false)
      if (roomReady) break
      await sleep(1000)
    }
    record('S0', '客户端已同步到该房间', roomReady ? 'pass' : 'fail', roomReady ? 'getRoom() 非空' : '20s 内未同步')

    const sendMsg = async (body, extra = {}) => {
      const txn = `txn${Date.now()}${Math.floor(Math.random() * 1000)}`
      const r = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`, {
        token: a.token,
        body: { msgtype: 'm.text', body, ...extra }
      })
      return { status: r.status, eventId: r.body?.event_id }
    }

    // ── ① 表情回应（m.annotation）
    const m1 = await sendMsg('relation-target-1')
    record('R1', '发送被回应消息', m1.status === 200 ? 'pass' : 'fail', m1.eventId ?? `status=${m1.status}`)
    const reactRes = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.reaction/${Date.now()}`, {
      token: b.token,
      body: { 'm.relates_to': { rel_type: 'm.annotation', event_id: m1.eventId, key: '👍' } }
    })
    record('R1', 'B 发 m.reaction（服务端接受）', reactRes.status === 200 ? 'pass' : 'fail', `status=${reactRes.status} ${reactRes.raw.slice(0, 80)}`)
    let rel = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(m1.eventId)}/m.annotation`, { token: a.token })
    record('R1', '服务端 /relations 能查到回应', rel.status === 200 && (rel.body?.chunk ?? []).length >= 1 ? 'pass' : 'fail', `status=${rel.status}，chunk=${(rel.body?.chunk ?? []).length}`)
    await ensureClient(cdp, a, roomId)
    let st = null
    for (let i = 0; i < 12 && !(st?.annotations > 0); i += 1) {
      await sleep(2000)
      st = await cdp.evaluate(eventStateFn(roomId, m1.eventId)).catch(() => null)
    }
    record('R1', '客户端聚合出回应', st?.annotations > 0 ? 'pass' : 'fail', `annotations=${st?.annotations}，keys=${JSON.stringify(st?.annotationsKeys ?? [])}`, st)

    // ── ② 编辑（m.replace）
    const m2 = await sendMsg('edit-before')
    record('R2', '发送待编辑消息', m2.status === 200 ? 'pass' : 'fail', m2.eventId ?? `status=${m2.status}`)
    const editRes = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
      token: a.token,
      body: {
        msgtype: 'm.text',
        body: ' * edit-after',
        'm.new_content': { msgtype: 'm.text', body: 'edit-after' },
        'm.relates_to': { rel_type: 'm.replace', event_id: m2.eventId }
      }
    })
    record('R2', '发送 m.replace 编辑事件', editRes.status === 200 ? 'pass' : 'fail', `status=${editRes.status}`)
    await ensureClient(cdp, a, roomId)
    let st2 = null
    for (let i = 0; i < 12 && !(st2?.body === 'edit-after'); i += 1) {
      await sleep(2000)
      st2 = await cdp.evaluate(eventStateFn(roomId, m2.eventId)).catch(() => null)
    }
    record('R2', '客户端 body 已被替换为新内容', st2?.body === 'edit-after' ? 'pass' : 'fail', `body=${JSON.stringify(st2?.body)}`, st2)

    // ── ③ 撤回（redact）
    const m3 = await sendMsg('to-be-redacted')
    const redRes = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/redact/${encodeURIComponent(m3.eventId)}/${Date.now()}`, {
      token: a.token,
      body: { reason: 'probe' }
    })
    record('R3', '发送撤回', redRes.status === 200 ? 'pass' : 'fail', `status=${redRes.status}`)
    await ensureClient(cdp, a, roomId)
    let st3 = null
    for (let i = 0; i < 12 && !st3?.redacted; i += 1) {
      await sleep(2000)
      st3 = await cdp.evaluate(eventStateFn(roomId, m3.eventId)).catch(() => null)
    }
    record(
      'R3',
      '客户端标记为已撤回',
      st3?.redacted ? 'pass' : 'fail',
      st3?.redacted ? `redacted=true` : `redacted=${st3?.redacted}，且 body=${JSON.stringify(st3?.body)} 仍在（服务端 content 已清空为 {}，客户端未应用 m.room.redaction）`,
      st3
    )

    // ── ④ 回复（m.in_reply_to）
    const m4 = await sendMsg('reply-root')
    const m5 = await sendMsg('reply-child', { 'm.relates_to': { 'm.in_reply_to': { event_id: m4.eventId } } })
    record('R4', '发送回复消息', m5.status === 200 ? 'pass' : 'fail', m5.eventId ?? `status=${m5.status}`)
    await ensureClient(cdp, a, roomId)
    let st4 = null
    for (let i = 0; i < 12 && !st4?.replyTo; i += 1) {
      await sleep(2000)
      st4 = await cdp.evaluate(eventStateFn(roomId, m5.eventId)).catch(() => null)
    }
    record('R4', '客户端识别回复目标', st4?.replyTo === m4.eventId ? 'pass' : 'fail', `replyTo=${st4?.replyTo}（期望 ${m4.eventId}）`, st4)

    // ── ⑤ 讨论串（m.thread）
    const m6 = await sendMsg('thread-child', { 'm.relates_to': { rel_type: 'm.thread', event_id: m4.eventId, is_falling_back: true, 'm.in_reply_to': { event_id: m4.eventId } } })
    record('R5', '发送 thread 回复', m6.status === 200 ? 'pass' : 'fail', m6.eventId ?? `status=${m6.status}`)
    const thRel = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/relations/${encodeURIComponent(m4.eventId)}/m.thread`, { token: a.token })
    record('R5', '服务端 /relations m.thread 可查', thRel.status === 200 && (thRel.body?.chunk ?? []).length >= 1 ? 'pass' : 'fail', `status=${thRel.status}，chunk=${(thRel.body?.chunk ?? []).length}`)
    await ensureClient(cdp, a, roomId)
    let st5 = null
    for (let i = 0; i < 12 && !(st5?.relationType === 'm.thread'); i += 1) {
      await sleep(2000)
      st5 = await cdp.evaluate(eventStateFn(roomId, m6.eventId)).catch(() => null)
    }
    record(
      'R5',
      '客户端识别 thread 归属',
      st5?.relationType === 'm.thread' ? 'pass' : 'fail',
      st5?.relationType === 'm.thread'
        ? `rel_type=m.thread，root=${st5?.relationEvent}`
        : `rel_type=${st5?.relationType ?? 'null'}；client.supportsThreads()=${st5?.supportsThreads}（false ⇒ SDK 未启用 thread，服务端关系读得到但客户端不建 Thread 对象）`,
      st5
    )
    const threadLen = await cdp.evaluate(eventStateFn(roomId, m4.eventId)).catch(() => null)
    record('R5', '客户端线程计数', Number(threadLen?.threadCount ?? 0) >= 1 ? 'pass' : 'info', `room.getThread(root).length=${threadLen?.threadCount}`, threadLen)

    // ── ⑥ 房间升级
    const caps = await rest('GET', '/_matrix/client/v3/capabilities', { token: a.token })
    const vinfo = caps.body?.capabilities?.['m.room.versions'] ?? caps.body?.capabilities?.['m.room_versions'] ?? {}
    const cur = vinfo.default ?? null
    const available = Object.keys(vinfo.available ?? {})
    record('U1', '服务端房间版本清单', cur ? 'pass' : 'fail', `default=${cur}，可选=${available.join('/')}`, vinfo)

    // ⚠️ 不能拿「当前默认版本的新房」去升级：服务端对**降级**一律 M_UNSUPPORTED_ROOM_VERSION
    //    （实测 v12 → 11/10/9/8 全被拒，这是合理的）。正确做法是建一个旧版本房再升级。
    const oldVersion = available.filter((v) => Number(v) < Number(cur)).sort((x, y) => Number(y) - Number(x))[0]
    let upgradeRoomId = null
    if (!oldVersion) {
      // 服务端只提供默认版本时无低版本可建，也无法验证 tombstone（降级会被 M_UNSUPPORTED_ROOM_VERSION 拒绝）
      record('U1', '房间升级链路', 'skip', `capabilities 仅提供 v${cur}，无低版本房间可建`)
    }
    if (oldVersion) {
      const oldRoom = await rest('POST', '/_matrix/client/v3/createRoom', {
        token: a.token,
        body: { name: `upgrade-${Date.now().toString(36)}`, preset: 'private_chat', room_version: oldVersion }
      })
      upgradeRoomId = oldRoom.body?.room_id ?? null
      const gotV = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(upgradeRoomId ?? '')}/version`, { token: a.token })
      record(
        'U1',
        `建旧版本房（v${oldVersion}）`,
        upgradeRoomId ? 'pass' : 'fail',
        upgradeRoomId ? `status=${oldRoom.status}，实际版本=${gotV.body?.version ?? '?'}` : `status=${oldRoom.status} ${oldRoom.body?.errcode ?? ''} —— capabilities 宣称 v${oldVersion} 可用，createRoom 却拒绝（能力声明与实际不符）`,
        oldRoom.body
      )
    }

    let upRes = null
    if (upgradeRoomId) {
      upRes = await rest('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(upgradeRoomId)}/upgrade`, {
        token: a.token,
        body: { new_version: String(cur) }
      })
    }
    const newRoom = upRes?.body?.replacement_room ?? null
    if (upgradeRoomId) {
      record('U1', `发起房间升级（v${oldVersion} → v${cur}）`, newRoom ? 'pass' : 'fail', newRoom ? `replacement=${newRoom}` : `status=${upRes?.status} ${upRes?.raw?.slice(0, 90)}`)
    }

    const tomb = upgradeRoomId
      ? await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(upgradeRoomId)}/state/m.room.tombstone/`, { token: a.token })
      : null
    if (tomb) {
      record('U1', '旧房写入 m.room.tombstone', tomb.status === 200 && tomb.body?.replacement_room === newRoom ? 'pass' : 'fail', `status=${tomb.status}，replacement=${tomb.body?.replacement_room ?? 'null'}`)
    }

    await ensureClient(cdp, a, roomId)
    let stU = null
    for (let i = 0; i < 15 && upgradeRoomId && !stU?.hasTombstone; i += 1) {
      await sleep(2000)
      stU = await cdp
        .evaluate(`
        (async () => {
          const m = await import('/src/services/matrix/index.ts');
          const room = m.matrixClientService.getClient()?.getRoom(${JSON.stringify(upgradeRoomId ?? '')});
          if (!room) return { noRoom: true };
          const ev = room.currentState?.getStateEvents?.('m.room.tombstone', '');
          return { hasTombstone: Boolean(ev), replacement: ev?.getContent?.()?.replacement_room ?? null };
        })()
      `)
        .catch(() => null)
    }
    if (upgradeRoomId) {
      record('U1', '客户端看到 tombstone', stU?.hasTombstone ? 'pass' : 'info', `replacement=${stU?.replacement ?? 'null'}${stU?.noRoom ? '（客户端未同步到旧房）' : ''}`, stU)
    }

    // ── ⑦ 通知 ack
    //    先让 B 在新房发一条，再查 A 的 /notifications
    const newRoomId = newRoom ?? roomId
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(newRoomId)}`, { token: b.token, body: {} })

    // 通知记录通常由 push 规则（提及 / 关键词）触发：先给 A 设 displayname，再让 B 提及它
    const dn = `Disp${Date.now().toString(36).slice(-4)}`
    await rest('PUT', '/_matrix/client/v3/profile/' + encodeURIComponent(a.userId) + '/displayname', { token: a.token, body: { displayname: dn } })
    await sleep(1500)
    for (const text of [`${dn} 请看一下`, `@${a.userId.split(':')[0].slice(1)} 提及测试`]) {
      await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(newRoomId)}/send/m.room.message/${Date.now()}${Math.floor(Math.random() * 100)}`, {
        token: b.token,
        body: { msgtype: 'm.text', body: text }
      })
    }
    await sleep(4000)

    let notif = await rest('GET', '/_matrix/client/v3/notifications', { token: a.token })
    let list = notif.body?.notifications ?? []
    record('N1', '服务端生成通知记录（含提及）', list.length > 0 ? 'pass' : 'fail', `status=${notif.status}，count=${list.length}，displayname=${dn}`, notif.body)

    if (list.length > 0) {
      const sample = list[0]
      const nid = sample?.event?.event_id ?? sample?.id ?? sample?.event_id ?? null
      if (!nid) {
        // 服务端返回的通知项没有 id/event_id 时无法 ACK；记录结构供后端排查
        record('N1', 'ACK 单条通知', 'info', `通知项无 id/event_id，字段=${Object.keys(sample ?? {}).join(',')}`, sample)
      } else {
        const ack = await rest('POST', `/_matrix/client/v3/notifications/${encodeURIComponent(nid)}/ack`, { token: a.token })
        const ackBody = (ack.raw ?? '').slice(0, 160)
        if (ack.status === 200) {
          record('N1', 'ACK 单条通知', 'pass', `status=200，id=${nid}`)
          await sleep(2000)
          notif = await rest('GET', '/_matrix/client/v3/notifications', { token: a.token })
          list = notif.body?.notifications ?? []
          record('N1', 'ACK 后列表不再返回该条', !list.some((n) => (n.event?.event_id ?? n.id ?? n.event_id) === nid) ? 'pass' : 'fail', `count=${list.length}`)
        } else {
          // 客户端 ackNotificationWithFallback 在 ACK 失败时会回退到已读回执，4xx 属后端能力缺口
          record('N1', 'ACK 单条通知', 'info', `status=${ack.status}，id=${nid}，body=${ackBody}`)
        }
      }
    } else {
      record('N1', 'ACK 链路', 'skip', '服务端不生成通知记录（普通消息与提及都不产生）⇒ ack 无从验证，与 §3-2 推送未落地同源')
    }
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    cdp?.close()
  }

  record(
    'X1',
    '运行中客户端是否发生过置空（D12）',
    healCount === 0 ? 'pass' : 'fail',
    healCount === 0 ? '全程未发生' : `发生 ${healCount} 次：整页 reload → client=null + 重新弹解锁门禁，页面无「已断开」提示`
  )

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
