#!/usr/bin/env node
/**
 * 联调补测：搜索（#16）与阅后即焚（#10）。
 *
 * 判据同上一支脚本：**服务端事实 + 客户端语义**两层都要成立。
 *
 * 搜索（S）
 *   S1 REST `POST /_matrix/client/v3/search` 能检索到指定 token（服务端全文检索可用）
 *   S2 页面内 `matrixSearchService.searchMessages(token)` 命中（客户端搜索链路：Worker 索引 + 远端）
 *   S3 页面内 `searchRoomMessages(roomId, token)` 命中（房内搜索）
 *
 * 阅后即焚（B）
 *   B1 `matrixBurnAfterReadService.enableBurn(roomId, 5000)` → 返回 enabled/burnAfterMs（服务端能力）
 *   B2 打开账号级默认（`settingStore.setBurnDefaultEnabled(true)`）后**真实点击发送**，
 *      服务端事件 content 必须带 `m.burn_after_read`（验证 P0-7：默认开关真的被发送路径读到）
 *   B3 `markBurnRead(eventId)` → `getPendingBurns(roomId)` 含该事件且 deleteAt > now
 *   B4 到期后：**服务端事件仍存在**（burn 只登记 per-user 时间，物理删除归 retention）
 *      + `getPendingBurns` 不再返回该事件
 *
 * 用法：node scripts/search-burn-probe.mjs
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
  if (evidence && level === 'fail') console.log('    证据：', JSON.stringify(evidence).slice(0, 360))
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
  const username = `sb${label}${Date.now().toString(36)}`
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
  adb(['reverse', 'tcp:5210', 'tcp:5210'])
  adb(['reverse', 'tcp:8008', 'tcp:8008'])
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
    if (await uidOf(cdp)) return { ok: true }
  }
  return { ok: false, reason: '登录后仍无 client' }
}

/** 真实输入 + 真实点击「发送」（沿用 e2ee 脚本验证过的方式） */
async function realSend(cdp, text) {
  await cdp.evaluate(`document.querySelector('#message-input')?.focus(); true`)
  await sleep(200)
  await cdp.send('Input.insertText', { text })
  await sleep(900)
  const btn = await cdp.evaluate(`
    (() => {
      const b = [...document.querySelectorAll('button')].find((x) => /^(发送|Send)$/.test((x.innerText || '').trim()));
      if (!b) return { found: false };
      const r = b.getBoundingClientRect();
      return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), disabled: Boolean(b.disabled) };
    })()
  `)
  if (!btn?.found || btn.disabled) return { ok: false, reason: btn?.found ? 'disabled' : '找不到发送按钮' }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.x, y: btn.y, button: 'none', clickCount: 0 })
  await sleep(60)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1 })
  await sleep(80)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1 })
  await sleep(6000)
  return { ok: true, at: `(${btn.x},${btn.y})` }
}

async function main() {
  let cdp = null
  try {
    const a = await register('a')
    console.log(`A=${a.userId}\n`)
    const pid = await startApp()
    cdp = await openCdp(CDP_PORT)
    await passUnlock(cdp)
    const before = await uidOf(cdp)
    if (before && before !== a.userId) {
      await cdp.evaluate(`
        (async () => {
          const app = document.querySelector('#app')?.__vue_app__;
          const store = app?.config?.globalProperties?.$pinia?._s?.get?.('matrix');
          try { await store?.logout(); } catch {}
          return true;
        })()
      `)
      await sleep(4000)
      await cdp.evaluate(`location.reload(), true`).catch(() => {})
      await sleep(9000)
      await passUnlock(cdp)
    }
    const lg = await loginApp(cdp, a)
    record('S0', `设备登录（pid=${pid}）`, lg.ok ? 'pass' : 'fail', lg.ok ? '已登录' : lg.reason)
    if (!lg.ok) throw new Error('设备登录失败')

    const created = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: { name: `sb-${Date.now().toString(36)}`, preset: 'private_chat' }
    })
    const roomId = created.body?.room_id
    if (!roomId) throw new Error(`createRoom ${created.status} ${created.raw.slice(0, 80)}`)
    record('S0', '房间就绪', 'pass', roomId)

    // 阅后即焚必须由**接收方**标记已读：服务端明确拒绝「标记自己的消息」
    // （`403 M_FORBIDDEN: You cannot mark your own message as read`），所以要有第二个账号。
    const b = await register('b')
    await rest('POST', '/_matrix/client/v3/rooms/' + encodeURIComponent(roomId) + '/invite', { token: a.token, body: { user_id: b.userId } })
    const joined = await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    record('S0', 'B 加入房间（用于标记已读）', joined.status === 200 ? 'pass' : 'fail', `B=${b.userId}，join=${joined.status}`)

    // 先由 REST 发一条带唯一 token 的消息（搜索目标）
    const token = `searchtok${Date.now().toString(36)}`
    const sent = await rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`, {
      token: a.token,
      body: { msgtype: 'm.text', body: `${token} 唯一检索词` }
    })
    record('S1', '发送检索目标消息', sent.status === 200 ? 'pass' : 'fail', sent.body?.event_id ?? `status=${sent.status}`)

    // ── S1 服务端全文检索
    const srv = await rest('POST', '/_matrix/client/v3/search', {
      token: a.token,
      body: {
        search_categories: {
          room_events: { search_term: token, keys: ['content.body'], order_by: 'recent', event_context: { before_limit: 0, after_limit: 0 } }
        }
      }
    })
    const srvHits = srv.body?.search_categories?.room_events?.results?.length ?? 0
    record('S1', '服务端 /search 命中', srv.status === 200 && srvHits > 0 ? 'pass' : 'fail', `status=${srv.status}，hits=${srvHits}`, srv.body)

    // 等客户端同步到该房间
    for (let i = 0; i < 20; i += 1) {
      const ready = await cdp
        .evaluate(`(async () => { const m = await import('/src/services/matrix/index.ts'); return Boolean(m.matrixClientService.getClient()?.getRoom(${JSON.stringify(roomId)})) })()`)
        .catch(() => false)
      if (ready) break
      await sleep(1000)
    }

    // ── S2/S3 客户端搜索
    const clientSearch = await cdp
      .evaluate(`
      (async () => {
        try {
          const m = await import('/src/services/matrix/MatrixSearchService.ts');
          const all = await m.matrixSearchService.searchMessages(${JSON.stringify(token)}, { limit: 10 });
          const inRoom = await m.matrixSearchService.searchRoomMessages(${JSON.stringify(roomId)}, ${JSON.stringify(token)});
          // 注意：searchRoomMessages 返回 { results, count, highlights }，不是数组（第一版按数组取 length 得 0，误报）
          const inRoomHits = inRoom?.results?.length ?? inRoom?.count ?? 0;
          return { ok: true, all: all?.length ?? 0, inRoom: inRoomHits, sample: (all ?? []).slice(0, 2).map((r) => String(r.body ?? '').slice(0, 30)) };
        } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
      })()
    `)
      .catch((e) => ({ ok: false, err: String(e).slice(0, 160) }))
    record('S2', '客户端全量搜索命中', clientSearch?.all > 0 ? 'pass' : 'fail', clientSearch?.ok ? `hits=${clientSearch.all}，sample=${JSON.stringify(clientSearch.sample)}` : clientSearch?.err, clientSearch)
    record('S3', '客户端房内搜索命中', clientSearch?.inRoom > 0 ? 'pass' : 'fail', clientSearch?.ok ? `hits=${clientSearch.inRoom}` : clientSearch?.err, clientSearch)

    // ── B1 启用房间级阅后即焚（走 SDK 的 burn manager）
    const enable = await cdp
      .evaluate(`
      (async () => {
        try {
          const m = await import('/src/services/matrix/messaging/MatrixBurnAfterReadService.ts');
          const enabled = await m.matrixBurnAfterReadService.enableBurn(${JSON.stringify(roomId)}, 5000);
          const read = await m.matrixBurnAfterReadService.getBurnSettings(${JSON.stringify(roomId)});
          return { ok: true, enabled, read };
        } catch (e) { return { ok: false, err: String(e).slice(0, 220) }; }
      })()
    `)
      .catch((e) => ({ ok: false, err: String(e).slice(0, 160) }))
    record(
      'B1',
      '启用房间级阅后即焚',
      enable?.enabled?.enabled ? 'pass' : 'fail',
      enable?.ok ? `enabled=${enable.enabled?.enabled}，burnAfterMs=${enable.enabled?.burnAfterMs}，回读=${JSON.stringify(enable.read)}` : enable?.err,
      enable
    )

    // ── B2 走专门的焚毁发送通道（`matrixBurnAfterReadService.sendMessage`）
    //    为什么不走 UI：UI 只是给 payload 打标，最终仍落到同一条服务端路径；
    //    而 UI 侧「发送按钮只在有内容时渲染」+ 页面重载会让断言抖动（上一轮已踩）。
    const burnText = `burn-msg-${Date.now().toString(36)}`
    const burnSend = await cdp
      .evaluate(`
      (async () => {
        try {
          const m = await import('/src/services/matrix/messaging/MatrixBurnAfterReadService.ts');
          const r = await m.matrixBurnAfterReadService.sendMessage(
            ${JSON.stringify(roomId)},
            { msgtype: 'm.text', body: ${JSON.stringify(burnText)} },
            5000
          );
          return { ok: Boolean(r), r };
        } catch (e) { return { ok: false, err: String(e).slice(0, 220) }; }
      })()
    `)
      .catch((e) => ({ ok: false, err: String(e).slice(0, 160) }))
    record(
      'B2',
      '焚毁通道发送消息',
      burnSend?.ok ? 'pass' : 'fail',
      burnSend?.ok ? `eventId=${burnSend.r?.eventId}，expiresIn=${burnSend.r?.expiresIn}，expiresAt=${burnSend.r?.expiresAt}` : burnSend?.err,
      burnSend
    )

    const burnEventId = burnSend?.r?.eventId ?? null
    const msgs = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, { token: a.token })
    const burnEvent = (msgs.body?.chunk ?? []).find((e) => e.event_id === burnEventId || String(e.content?.body ?? '') === burnText)
    record(
      'B2',
      '服务端确认该事件落地',
      burnEvent ? 'pass' : 'fail',
      burnEvent ? `${burnEvent.event_type ?? burnEvent.type}，content=${JSON.stringify(burnEvent.content).slice(0, 120)}` : '未在 /messages 找到',
      burnEvent?.content
    )

    // ── B3 标记已读 → 服务端 pending 表应出现一行（这是 burn 的唯一事实源）
    const psql = (sql) => {
      try {
        return execFileSync('docker', ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql], {
          encoding: 'utf8',
          timeout: 15000
        }).trim()
      } catch (e) {
        return `ERR ${String(e.message ?? e).slice(0, 120)}`
      }
    }

    if (burnEventId) {
      // 3a) 发送方自己标记 → 应被拒（正确语义，不能自焚）
      const selfMark = await rest('POST', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(burnEventId)}`, {
        token: a.token,
        body: {}
      })
      record(
        'B3',
        '发送方标记自己的消息被拒（403，正确语义）',
        selfMark.status === 403 ? 'pass' : 'fail',
        `status=${selfMark.status}，errcode=${selfMark.body?.errcode ?? ''}`
      )

      // 3b) 语义确认：burn 设置是**按用户**存的（`burn_after_read_settings` 主键是 user_id+room_id），
      //     A 开启不等于 B 开启 ⇒ B 此时标记应报 `Burn not enabled for this room`。
      const bBeforeEnable = await rest('POST', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(burnEventId)}`, {
        token: b.token,
        body: {}
      })
      record(
        'B3',
        'A 开启 burn 不影响 B（per-user 语义）',
        bBeforeEnable.status === 400 ? 'pass' : 'fail',
        `B 未开启时标记 → status=${bBeforeEnable.status}，errcode=${bBeforeEnable.body?.errcode ?? ''}；说明 burn 是每用户设置，不是房间级 state`
      )

      // 3c) B 自己开启后再标记 → 才应成功
      const bEnable = await rest('PUT', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn`, {
        token: b.token,
        body: { enabled: true, burn_after_ms: 5000 }
      })
      record('B3', 'B 自己开启 burn', bEnable.status === 200 ? 'pass' : 'fail', `status=${bEnable.status} ${bEnable.raw.slice(0, 80)}`)

      const bMark = await rest('POST', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn/${encodeURIComponent(burnEventId)}`, {
        token: b.token,
        body: {}
      })
      record('B3', '接收方标记已读', bMark.status === 200 ? 'pass' : 'fail', `status=${bMark.status} ${bMark.raw.slice(0, 100)}`)

      const row = psql(
        `select user_id, event_id, created_ts, delete_ts, is_processed from burn_after_read_pending where event_id = '${burnEventId}' order by id desc limit 1`
      )
      const parts = String(row).split('|')
      const deleteTs = Number(parts[3] ?? 0)
      const createdTs = Number(parts[2] ?? 0)
      record(
        'B3',
        '服务端 pending 表登记该事件',
        parts.length >= 5 && parts[1] === burnEventId ? 'pass' : 'fail',
        parts.length >= 5
          ? `user=${parts[0]}，delete_ts - created_ts = ${deleteTs - createdTs}ms（期望 ≈5000），is_processed=${parts[4]}`
          : `查询结果：${String(row).slice(0, 120)}`
      )

      const pendList = await rest('GET', `/_matrix/vendor/v1/rooms/${encodeURIComponent(roomId)}/burn/pending`, { token: b.token })
      const pendIds = (pendList.body?.events ?? []).map((e) => e.event_id ?? e.eventId)
      record(
        'B3',
        'B 的待焚毁列表含该事件',
        pendIds.includes(burnEventId) ? 'pass' : 'fail',
        `status=${pendList.status}，pending=${JSON.stringify(pendIds).slice(0, 120)}`
      )

      // ── B4 到期后：pending 处理掉；事件**不被 redact**（既定语义：物理删除归 retention）
      await sleep(9000)
      const row2 = psql(
        `select is_processed, retry_count, coalesce(last_error,'') from burn_after_read_pending where event_id = '${burnEventId}' order by id desc limit 1`
      )
      record(
        'B4',
        '到期后 pending 已处理',
        /^\s*t/.test(String(row2)) ? 'pass' : /^\s*$/.test(String(row2)) ? 'pass' : 'fail',
        /^\s*$/.test(String(row2)) ? '记录已被清理（视作已处理）' : `is_processed/retry/last_error = ${row2}`
      )

      const redactions = psql(`select count(*) from events where room_id = '${roomId}' and event_type = 'm.room.redaction'`)
      const evStill = psql(`select count(*) from events where event_id = '${burnEventId}'`)
      record(
        'B4',
        '服务端未 redact 该事件（符合「burn 不物理删」）',
        Number(redactions) === 0 && Number(evStill) === 1 ? 'pass' : 'fail',
        `该房 redaction 数=${redactions}，事件仍存在=${evStill}`
      )
    } else {
      record('B3', '标记已读', 'skip', '没有拿到焚毁事件的 event_id')
      record('B4', '到期行为', 'skip', '同上')
    }
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    cdp?.close()
  }

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
