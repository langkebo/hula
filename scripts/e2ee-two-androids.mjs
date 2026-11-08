#!/usr/bin/env node
/**
 * E2EE 双**移动端**联调：两台 Android 模拟器互相收发（等价于「两台真机」）。
 *
 * 为什么不用 iOS 模拟器（2026-11-08 实测结论，见专项文档 §8）：
 *   iOS 侧应用能构建/安装/启动（已跑通），但**没有可用的 UI 注入通道** ——
 *   WKWebView 无 CDP、`simctl` 无 tap、AppleScript 被拒（-10004）、
 *   `idb-companion` 因本机禁止 `sandbox-exec` 装不上。
 *   因此「自动化的双端互测」只能落在两台 Android 上。
 *
 * 两台设备的约定：
 *   - A: serial `emulator-5554`，CDP 9222
 *   - B: serial `emulator-5556`，CDP 9223
 * 每台都要 `adb reverse tcp:5210/8008` + `adb forward <cdp> localabstract:webview_devtools_remote_<pid>`。
 *
 * 用法：node scripts/e2ee-two-androids.mjs
 */

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const DEVICES = {
  a: { label: 'A(5554)', cdp: Number(process.env.CDP_A ?? 9222) },
  b: { label: 'B(5556)', cdp: Number(process.env.CDP_B ?? 9223) }
}

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail, evidence: evidence ?? null })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
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

const rand = (n) => {
  const cs = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < n; i += 1) s += cs[Math.floor(Math.random() * cs.length)]
  return s
}

async function register(label) {
  const username = `two${label}${Date.now().toString(36)}${rand(3)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, password: PASSWORD, userId: r.body.user_id, token: r.body.access_token, deviceId: r.body.device_id }
    if (r.status === 429) {
      await sleep(1200)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 150)}`)
  }
  throw new Error('register 限流')
}

/* ── 每台设备一个 CDP 连接（需要 Input 域做真实点击）──────────────────── */
async function openCdp(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('tauri.localhost'))
  if (!page) throw new Error(`:${port} 没有 tauri WebView target（forward 失效或 app 未起）`)
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error(`:${port} CDP 连接失败`)))
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
  return { send, evaluate, close: () => ws.close(), url: page.url }
}

/**
 * 确保本地解锁已配置且已解锁。
 *
 * 首次使用的新设备**不会弹窗**（没有 verifier），而是直接 fail-closed ——
 * 这时只处理弹窗是不够的，必须主动 configureLocalUnlock，否则 crypto 永远不初始化。
 */
async function ensureLocalUnlock(cdp, pw) {
  const before = await cdp.evaluate(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      return { configured: m.isLocalUnlockConfigured(), unlocked: m.isLocalUnlockUnlocked(), keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
    })()
  `).catch(() => ({ error: 'import failed' }))
  if (before?.unlocked && Number(before.keyLen) === 32) return { ...before, action: 'already' }
  if (before?.configured) {
    const r = await cdp.evaluate(`
      (async () => {
        const m = await import('/src/services/secure/localUnlockKey.ts');
        const ok = await m.unlockLocalUnlock(${JSON.stringify(pw)});
        return { ok, keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
      })()
    `)
    return { ...before, action: 'unlocked', ...r }
  }
  const r = await cdp.evaluate(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      await m.configureLocalUnlock(${JSON.stringify(pw)});
      return { configured: m.isLocalUnlockConfigured(), keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
    })()
  `)
  return { ...before, action: 'configured', ...r }
}

/** 冷启动解锁弹窗 → 填密码 → 点「解锁」 */
async function passUnlockDialog(cdp, pw) {
  const has = await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`)
  if (!has) return { present: false }
  await cdp.evaluate(`
    (() => {
      const el = [...document.querySelectorAll('input')].find((i) => i.type === 'password' || !i.type);
      if (!el) return false;
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(el, ${JSON.stringify(pw)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `)
  await sleep(400)
  await cdp.evaluate(`
    (() => {
      const b = [...document.querySelectorAll('button, .van-dialog__confirm, [role="button"]')]
        .find((x) => /^解锁$/.test((x.innerText || '').trim()));
      b?.click();
      return true;
    })()
  `)
  for (let i = 0; i < 15; i += 1) {
    await sleep(1000)
    if (!(await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`))) return { present: true, ok: true }
  }
  return { present: true, ok: false }
}

async function login(cdp, username, password) {
  // 等表单（splashscreen → login 可能 10s+）
  for (let i = 0; i < 25; i += 1) {
    const n = await cdp.evaluate('document.querySelectorAll("input").length')
    if (Number(n) >= 3) break
    if (i === 8) {
      await cdp.evaluate(`
        (() => {
          const r = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
          r?.push({ name: 'mobileLogin' }).catch(() => {});
          return true;
        })()
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
      if (!account || !pwd) return { ok: false, inputs: inputs.map((i) => i.placeholder) };
      if (server) s(server, ${JSON.stringify(BASE)});
      s(account, ${JSON.stringify(username)});
      s(pwd, ${JSON.stringify(password)});
      return { ok: true };
    })()
  `)
  if (!filled?.ok) return { ok: false, reason: '填表失败', detail: filled }
  await sleep(500)
  await cdp.evaluate(`
    (() => {
      const b = [...document.querySelectorAll('button, .van-button')].find((x) => (x.innerText || '').trim() === '登录');
      b?.click();
      return true;
    })()
  `)
  for (let i = 0; i < 30; i += 1) {
    await sleep(1000)
    const href = await cdp.evaluate('location.href')
    if (!href.includes('/login')) return { ok: true, href }
  }
  const href = await cdp.evaluate('location.href')
  const toast = await cdp.evaluate(`
    [...document.querySelectorAll('.van-toast,.van-notify,.n-message')].map((e) => (e.innerText || '').trim()).join('|')
  `)
  return { ok: false, reason: `仍在登录页 ${href}${toast ? ' / ' + toast : ''}` }
}

async function waitDeviceKeys(userId, token, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const q = await rest('POST', '/_matrix/client/v3/keys/query', { token, body: { device_keys: { [userId]: [] } } })
    const devices = q.body?.device_keys?.[userId] ?? {}
    const withKeys = Object.entries(devices).filter(([, d]) => d?.keys)
    last = { count: Object.keys(devices).length, withKeys: withKeys.length }
    if (withKeys.length) return { ok: true, ...last, deviceId: withKeys[0][0] }
    await sleep(2000)
  }
  return { ok: false, ...(last ?? {}) }
}

async function gotoTargetRoom(cdp, roomId) {
  await cdp.evaluate(`
    (() => {
      const r = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
      r?.push({ name: 'mobileChatMain', params: { roomId: ${JSON.stringify(roomId)} } }).catch(() => {});
      return true;
    })()
  `)
  for (let i = 0; i < 20; i += 1) {
    await sleep(1000)
    const ok = await cdp.evaluate(`Boolean(document.querySelector('#message-input'))`)
    if (ok) return { ok: true, waitedMs: (i + 1) * 1000 }
  }
  return { ok: false }
}

/** 真实输入 + 真实点击「发送」 */
async function realSend(cdp, text) {
  await cdp.evaluate(`document.querySelector('#message-input')?.focus(); true`)
  await sleep(200)
  await cdp.send('Input.insertText', { text })
  await sleep(800)
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
  const composer = await cdp.evaluate(`(document.querySelector('#message-input')?.innerText ?? '').trim()`)
  return { ok: true, composerCleared: !String(composer).includes(text) }
}

/** 读 timeline 事件（判据用它，不用 innerText） */
async function readTimeline(cdp, roomId) {
  return cdp.evaluate(`
    (async () => {
      const m = await import('/src/services/matrix/index.ts');
      const room = m.matrixClientService.getClient()?.getRoom(${JSON.stringify(roomId)});
      const evs = room?.getLiveTimeline?.()?.getEvents?.() ?? [];
      return {
        count: evs.length,
        utd: evs.filter((e) => e.isDecryptionFailure?.()).length,
        bodies: evs.map((e) => String(e.getContent?.()?.body ?? ''))
      };
    })()
  `)
}

async function main() {
  const started = Date.now()
  let aCdp = null
  let bCdp = null
  let roomId = null
  const ctx = {}

  try {
    const a = await register('a')
    const b = await register('b')
    ctx.a = a
    ctx.b = b
    const created = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: {
        name: `two-android-${Date.now().toString(36)}`,
        preset: 'private_chat',
        invite: [b.userId],
        initial_state: [{ type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }]
      }
    })
    if (created.status !== 200) throw new Error(`createRoom ${created.status}`)
    roomId = created.body.room_id
    ctx.roomId = roomId
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    record('S0', '账号与加密房', 'pass', roomId)

    aCdp = await openCdp(DEVICES.a.cdp)
    bCdp = await openCdp(DEVICES.b.cdp)
    record('S0', '两台设备 CDP 就绪', 'pass', `${DEVICES.a.label}:${DEVICES.a.cdp} · ${DEVICES.b.label}:${DEVICES.b.cdp}`)

    // 两端：解锁门禁 → 登录 → crypto
    for (const [key, cdp, account] of [
      ['A', aCdp, a],
      ['B', bCdp, b]
    ]) {
      // 首屏可能长时间停在 splashscreen（dev server 冷启动 + WebView 初始化），
      // 必须等「解锁弹窗」或「登录表单」出现再动手，否则会误判「未出现弹窗 / 填表失败」。
      for (let i = 0; i < 40; i += 1) {
        const st = await cdp.evaluate(`
          (() => ({
            n: document.querySelectorAll('input').length,
            unlock: document.body.innerText.includes('输入本地解锁密码')
          }))()
        `)
        if (st?.unlock || Number(st?.n) >= 3) break
        await sleep(1000)
      }
      const unlock = await passUnlockDialog(cdp, UNLOCK_PW)
      const ensure = await ensureLocalUnlock(cdp, UNLOCK_PW)
      record(
        `S1${key}`,
        '解锁状态（storageKey 是否可得）',
        Number(ensure?.keyLen) === 32 ? 'pass' : 'fail',
        `${ensure?.action ?? '?'}，keyLen=${ensure?.keyLen ?? 0}${unlock.present ? '，弹窗=' + (unlock.ok ? '已过' : '未过') : ''}`,
        { unlock, ensure }
      )

      // 已登录则先登出，保证走真实登录链路（crypto 初始化挂在登录上）
      const href0 = await cdp.evaluate('location.href')
      if (!href0.includes('/login')) {
        await cdp.evaluate(`
          (async () => {
            const app = document.querySelector('#app')?.__vue_app__;
            const store = app?.config?.globalProperties?.$pinia?._s?.get?.('matrix');
            try { await store?.logout(); } catch {}
            app?.config?.globalProperties?.$router?.push({ name: 'mobileLogin' }).catch(() => {});
            return true;
          })()
        `)
        await sleep(4000)
        await passUnlockDialog(cdp, UNLOCK_PW)
      }

      const lg = await login(cdp, account.username, account.password)
      record(`S1${key}`, '登录', lg.ok ? 'pass' : 'fail', lg.ok ? lg.href : lg.reason)
      const keys = await waitDeviceKeys(account.userId, account.token, key)
      record(`S1${key}`, 'crypto 就绪（device_keys 上报）', keys.ok ? 'pass' : 'fail', keys.ok ? `device=${keys.deviceId}` : '60s 未上报', keys)
    }

    // A → B（真实点击）
    const navA = await gotoTargetRoom(aCdp, roomId)
    record('S2', 'A 端进入加密房', navA.ok ? 'pass' : 'fail', navA.ok ? `${navA.waitedMs}ms` : '找不到输入框')

    const textA = `from-A-${Date.now()}`
    const sendA = await realSend(aCdp, textA)
    record('S2', 'A 端真实点击发送', sendA.ok ? 'pass' : 'fail', sendA.ok ? `输入框已清空=${sendA.composerCleared}` : sendA.reason)
    ctx.textA = textA
    await sleep(4000)

    const msgs = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, { token: a.token })
    const enc = (msgs.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
    const plain = (msgs.body?.chunk ?? []).filter((e) => e.type === 'm.room.message')
    record('S2', '服务端消息形态', enc.length ? 'pass' : 'fail', `encrypted=${enc.length} / plaintext=${plain.length}`)

    // B 端是否解密渲染
    const navB = await gotoTargetRoom(bCdp, roomId)
    record('S3', 'B 端进入加密房', navB.ok ? 'pass' : 'fail', navB.ok ? `${navB.waitedMs}ms` : '找不到输入框')
    await sleep(6000)
    let tlB = await readTimeline(bCdp, roomId)
    // 等解密完成（最多 20s）
    for (let i = 0; i < 10 && !tlB.bodies.some((x) => x.includes(textA)); i += 1) {
      await sleep(2000)
      tlB = await readTimeline(bCdp, roomId)
    }
    const gotA = tlB.bodies.some((x) => x.includes(textA))
    record(
      'S3',
      'B 端解密显示 A 的消息',
      gotA ? 'pass' : tlB.utd > 0 ? 'info' : 'fail',
      gotA ? `timeline 含 ${textA}` : `timeline=${tlB.count} 条，UTD=${tlB.utd}`,
      { utd: tlB.utd }
    )

    // B → A
    const textB = `from-B-${Date.now()}`
    const sendB = await realSend(bCdp, textB)
    record('S4', 'B 端真实点击发送', sendB.ok ? 'pass' : 'fail', sendB.ok ? `输入框已清空=${sendB.composerCleared}` : sendB.reason)
    await sleep(6000)
    let tlA = await readTimeline(aCdp, roomId)
    for (let i = 0; i < 10 && !tlA.bodies.some((x) => x.includes(textB)); i += 1) {
      await sleep(2000)
      tlA = await readTimeline(aCdp, roomId)
    }
    const gotB = tlA.bodies.some((x) => x.includes(textB))
    record('S4', 'A 端解密显示 B 的消息', gotB ? 'pass' : tlA.utd > 0 ? 'info' : 'fail', gotB ? `timeline 含 ${textB}` : `timeline=${tlA.count} 条，UTD=${tlA.utd}`)

    const msgs2 = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, { token: a.token })
    const enc2 = (msgs2.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
    record('S4', '双向都落 m.room.encrypted', enc2.length >= 2 ? 'pass' : 'fail', `${enc2.length} 条`)
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    aCdp?.close()
    bCdp?.close()
  }

  const summary = {
    durationMs: Date.now() - started,
    pass: results.filter((r) => r.level === 'pass').length,
    fail: results.filter((r) => r.level === 'fail').length,
    skip: results.filter((r) => r.level === 'skip').length,
    info: results.filter((r) => r.level === 'info').length,
    roomId,
    accounts: ctx.a ? { a: ctx.a.username, b: ctx.b.username, password: PASSWORD } : null,
    results
  }
  console.log(`\n== 汇总：${summary.pass} passed / ${summary.fail} failed / ${summary.info} info，${(summary.durationMs / 1000).toFixed(1)}s ==`)
  if (roomId) console.log(`房间 ${roomId}；账号 ${ctx.a?.username} / ${ctx.b?.username}（密码 ${PASSWORD}）`)
  process.exitCode = summary.fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exitCode = 2
})
