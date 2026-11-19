#!/usr/bin/env node
/**
 * 转发（`m.reference` 副本）联调探针。
 *
 * 覆盖报告 §二「转发」那一条：前端已有 `MatrixForwardService`，但没有自动化判据。
 *
 * 判据（同其它探针：客户端 + 服务端两层都成立才算过）：
 *   F1 客户端 `matrixForwardService.forwardRoomMessages(src, [ev], [target])` 返回 success
 *   F2 目标房出现新事件，`body` 与原事件一致
 *   F3 协议形态：`m.relates_to.rel_type === "m.reference"` 且 `event_id` 指向源事件
 *      （Matrix 没有标准 `m.forward`，本仓实现是「副本 + reference 关联」）
 *   F4 源房事件未被 redact（转发是复制，不是移动）
 *   F5 安全门：带 `file.key`（已解密附件密钥）的消息**不得**转发进明文房
 *      —— 否则等于把附件解密密钥公开写进目标房（`hasEncryptedFile` 守卫）
 *
 * 用法：
 *   E2EE_BASE=http://127.0.0.1:8008 node scripts/forward-probe.mjs
 *   PROBE_KEEP_STATE=1 node scripts/forward-probe.mjs   # 保留设备现场
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { guardApkFreshness, resetAppState } from './lib/probe-runtime.mjs'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const CDP_PORT = Number(process.env.CDP_A ?? 9222)
const SERIAL = process.env.ADB_SERIAL ?? 'emulator-5554'
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const ANDROID_HOME = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
const ADB =
  [process.env.ADB, `${ANDROID_HOME}/platform-tools/adb`, 'adb'].find((p) => p && (p === 'adb' || existsSync(p))) ?? 'adb'

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
  const username = `fwd${label}${Date.now().toString(36)}`
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

async function startApp() {
  const hostPort = new URL(BASE).port || '80'
  adb(['reverse', 'tcp:5210', 'tcp:5210'])
  adb(['reverse', 'tcp:8008', `tcp:${hostPort}`])
  adb(['forward', '--remove', `tcp:${CDP_PORT}`])
  adb(['shell', 'am', 'force-stop', 'com.tjg.app'])
  await sleep(1500)
  adb(['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])
  await sleep(5000)
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
  // ⚠️ 登录页上有**两个**「登录」文本：「登录/注册」切换 tab（class 含 `login-tab`）和真正的
  // 提交按钮。原先用 `innerText === '登录'` 的 `.find()` 取到的是**第一个 —— 那个 tab**，
  // 点它只是切 tab，永远不提交，表现成「登录后仍未切到目标账号」（2026-11-19 定位）。
  // `e2e/support/androidDevice.ts` 用 `[data-testid="mobile-login-submit"]` 所以它不受影响。
  // 这里改为 testid 优先，兜底再用文本并排除 tab。
  const SUBMIT_FINDER = `
    const findBtn = () => {
      const byTestId = document.querySelector('[data-testid="mobile-login-submit"]');
      if (byTestId) return byTestId;
      return [...document.querySelectorAll('button, .van-button')].find(
        (x) => (x.innerText || '').trim() === '登录' && !String(x.className || '').includes('login-tab')
      );
    };`
  const gate = await cdp.evaluate(`
    (() => {
      ${SUBMIT_FINDER}
      const disabled = (b) => Boolean(b && (b.disabled === true || b.classList.contains('van-button--disabled') || b.getAttribute('aria-disabled') === 'true'));
      const btn = findBtn();
      if (!btn) return 'no-button';
      if (!disabled(btn)) return 'ready';
      const icon = document.querySelector('.van-checkbox__icon') || document.querySelector('.van-checkbox');
      if (!icon) return 'disabled-no-checkbox';
      icon.click();
      return disabled(findBtn()) ? 'still-disabled' : 'unlocked';
    })()
  `)
  await sleep(500)
  if (gate === 'no-button' || gate === 'disabled-no-checkbox' || gate === 'still-disabled') {
    return { ok: false, reason: `登录按钮不可点（${gate}）` }
  }
  await cdp.evaluate(`
    (() => { ${SUBMIT_FINDER} findBtn()?.click(); return true })()
  `)
  for (let i = 0; i < 45; i += 1) {
    await sleep(1000)
    const uid = await uidOf(cdp)
    if (uid && (!account?.userId || uid === account.userId)) return { ok: true }
  }
  return { ok: false, reason: '登录后仍未切到目标账号' }
}

const sendText = (token, roomId, body) =>
  rest('PUT', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}${Math.floor(Math.random() * 1000)}`, {
    token,
    body
  })

/** 等客户端把某事件同步进 timeline（转发要 `getRoomMessage` 读得到才能发） */
async function waitEventSynced(cdp, roomId, eventId, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const found = await cdp
      .evaluate(`
      (async () => {
        try {
          const m = await import('/src/services/matrix/index.ts');
          const room = m.matrixClientService.getClient?.()?.getRoom(${JSON.stringify(roomId)}) ?? null;
          return Boolean(room?.findEventById(${JSON.stringify(eventId)}));
        } catch { return false; }
      })()
    `)
      .catch(() => false)
    if (found) return Date.now() - started
    await sleep(1000)
  }
  return null
}

/** 页面内调用转发（走真实服务单例） */
const forwardInPage = (cdp, srcRoomId, eventId, targetRoomId) =>
  cdp.evaluate(`
    (async () => {
      try {
        const mod = await import('/src/services/matrix/messaging/MatrixForwardService.ts');
        const out = await mod.matrixForwardService.forwardRoomMessages(
          ${JSON.stringify(srcRoomId)},
          [${JSON.stringify(eventId)}],
          [${JSON.stringify(targetRoomId)}]
        );
        return { ok: true, out };
      } catch (e) {
        return { ok: false, err: String((e && e.message) || e) };
      }
    })()
  `)

/** 目标房里按 body 找消息（服务端事实） */
async function findInRoom(token, roomId, needle) {
  const msgs = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, { token })
  const chunk = msgs.body?.chunk ?? []
  return chunk.find((e) => String(e.content?.body ?? '').includes(needle)) ?? null
}

async function main() {
  let cdp = null
  try {
    guardApkFreshness()
    resetAppState(ADB, SERIAL)
    const a = await register('a')
    const b = await register('b')
    console.log(`A=${a.userId}  B=${b.userId}\n`)

    // 源房 + 明文目标房（B join，保证是「两人普通房」）
    const src = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: { name: 'fwd-src', preset: 'private_chat', invite: [b.userId] }
    })
    const target = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: { name: 'fwd-target', preset: 'private_chat', invite: [b.userId] }
    })
    const srcRoomId = src.body?.room_id ?? null
    const targetRoomId = target.body?.room_id ?? null
    record(
      'F0',
      '源房与目标房就绪（均未加密）',
      srcRoomId && targetRoomId ? 'pass' : 'fail',
      `src=${srcRoomId}，target=${targetRoomId}`
    )
    if (!srcRoomId || !targetRoomId) throw new Error('建房失败')
    for (const roomId of [srcRoomId, targetRoomId]) {
      await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    }

    const pid = await startApp()
    cdp = await openCdp(CDP_PORT)
    await passUnlock(cdp)
    const lg = await loginApp(cdp, a)
    record('F0', '设备登录 A', lg.ok ? 'pass' : 'fail', lg.ok ? `pid=${pid}` : lg.reason)
    if (!lg.ok) throw new Error('登录失败，后续判据无法取证')

    // ── 正向：普通文本转发
    const srcText = `fwd-src-${Date.now().toString(36)}`
    const sent = await sendText(a.token, srcRoomId, { msgtype: 'm.text', body: srcText })
    const srcEventId = sent.body?.event_id ?? null
    record('F1', '源房发送待转发消息', sent.status === 200 && srcEventId ? 'pass' : 'fail', `event=${srcEventId}`)
    if (!srcEventId) throw new Error('源消息未发出')

    const syncWait = await waitEventSynced(cdp, srcRoomId, srcEventId)
    record('F1', '客户端已同步该事件', syncWait !== null ? 'pass' : 'fail', syncWait !== null ? `${syncWait}ms` : '30s 未同步')

    const fwd = await forwardInPage(cdp, srcRoomId, srcEventId, targetRoomId)
    const fwdResult = Array.isArray(fwd?.out) ? fwd.out[0] : null
    record(
      'F1',
      '客户端调用转发返回 success',
      fwd?.ok && fwdResult?.success ? 'pass' : 'fail',
      fwd?.ok ? `roomId=${fwdResult?.roomId}，eventId=${fwdResult?.eventId ?? '—'}，error=${fwdResult?.error ?? '—'}` : fwd?.err,
      fwd
    )

    // ── F2/F3：服务端核验目标房事件形态
    const forwarded = await findInRoom(a.token, targetRoomId, srcText)
    record('F2', '目标房出现转发副本', forwarded ? 'pass' : 'fail', forwarded ? `event=${forwarded.event_id}` : '未找到', forwarded?.content)

    const relatesTo = forwarded?.content?.['m.relates_to']
    record(
      'F3',
      '协议形态为 m.reference 且指向源事件',
      relatesTo?.rel_type === 'm.reference' && relatesTo?.event_id === srcEventId ? 'pass' : 'fail',
      `rel_type=${relatesTo?.rel_type ?? '—'}，event_id=${relatesTo?.event_id ?? '—'}（期望 ${srcEventId}）`,
      relatesTo
    )

    // ── F4：源事件仍在（转发=复制，不是移动）
    const srcStill = await findInRoom(a.token, srcRoomId, srcText)
    record('F4', '源房原事件未被 redact', srcStill ? 'pass' : 'fail', srcStill ? `event=${srcStill.event_id}` : '源事件消失')

    // ── F5：安全门 —— 带解密密钥的附件不得转发进明文房
    const encBody = `fwd-enc-${Date.now().toString(36)}`
    const encSend = await sendText(a.token, srcRoomId, {
      msgtype: 'm.image',
      body: encBody,
      file: {
        url: 'mxc://matrix.test/fake',
        key: { k: 'FAKE_AES_KEY_SHOULD_NOT_LEAK', alg: 'A256CTR', key_ops: ['encrypt', 'decrypt'], kty: 'oct' },
        iv: 'ZmFrZQ',
        hashes: { sha256: 'ZmFrZQ' },
        v: 'v2'
      }
    })
    if (encSend.status !== 200) {
      record('F5', '安全门（加密附件 → 明文房）', 'skip', `构造带 file.key 的事件失败：status=${encSend.status}`)
    } else {
      const encEventId = encSend.body?.event_id ?? null
      const encSynced = encEventId ? await waitEventSynced(cdp, srcRoomId, encEventId) : null
      if (!encSynced) {
        record('F5', '安全门（加密附件 → 明文房）', 'skip', '带密钥事件未同步到客户端，无法取证')
      } else {
        const blocked = await forwardInPage(cdp, srcRoomId, encEventId, targetRoomId)
        const leaked = await findInRoom(a.token, targetRoomId, encBody)
        // `forwardEventToMultipleRooms` 不抛错，而是逐房返回 success/error ⇒ 判据要看那一项
        const blockedResult = Array.isArray(blocked?.out) ? blocked.out[0] : null
        const refused =
          blocked?.ok === true &&
          blockedResult?.success === false &&
          /加密附件|解密密钥/.test(String(blockedResult?.error ?? ''))
        record(
          'F5',
          '带 file.key 的消息被拒绝转发进明文房',
          refused && !leaked ? 'pass' : 'fail',
          refused ? `返回 success=false：${String(blockedResult.error).slice(0, 60)}` : `未拦截，目标房事件=${leaked?.event_id ?? '—'}`,
          { blocked, leaked: leaked?.content }
        )
      }
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
