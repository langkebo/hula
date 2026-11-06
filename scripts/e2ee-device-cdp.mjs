#!/usr/bin/env node
/**
 * E2EE 真机（Android 模拟器 / 真机）联调脚本 —— 通过 CDP 驱动 Tauri WebView。
 *
 * 为什么用 CDP 而不是 uiautomator/Appium：
 *   `adb shell uiautomator dump` 对 Tauri WebView 实测**取不到任何节点**（0 个带文本节点），
 *   但 debug 构建的 WebView 开了 `webview_devtools_remote_<pid>`，forward 到 9222 后
 *   就是标准 Chrome DevTools Protocol，可以读 DOM / 执行 JS / 观察路由。
 *
 * 覆盖（对应联调报告 §3-1「E2EE 端到端」的真机步骤）：
 *   D0 环境      — CDP 可达、目标页、设备信息
 *   D1 登录      — 真机 WebView 内完成账号密码登录（DOM 事件，非注入 token）
 *   D2 crypto    — 本地解锁态 / storageKey 可得性 / crypto 初始化结果
 *   D3 密钥上报  — 客户端是否**自己**上传了 device_keys（E2EE 的必要条件，服务端侧验证）
 *   D4 进房发消息 — 导航到加密房，发送一条文本，看服务端落的是明文还是 m.room.encrypted
 *   D5 收消息    — 另一账号发一条，真机是否渲染出来（能渲染 = 解密成功或未加密）
 *
 * 用法：
 *   node scripts/e2ee-device-cdp.mjs                       # 自动注册账号并跑全流程
 *   E2EE_BASE=http://127.0.0.1:8008 CDP_PORT=9222 node scripts/e2ee-device-cdp.mjs
 *   E2EE_JSON=1 node scripts/e2ee-device-cdp.mjs
 *
 * 前置：
 *   1) 后端可达（默认 127.0.0.1:8008）
 *   2) dev server 在 5210（`TAURI_ENV_PLATFORM=android npx vite --host 127.0.0.1 --port 5210`）
 *   3) `adb reverse tcp:5210 tcp:5210 && adb reverse tcp:8008 tcp:8008`
 *   4) `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`
 */

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const CDP = `http://${process.env.CDP_HOST ?? '127.0.0.1'}:${process.env.CDP_PORT ?? 9222}`
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const JSON_ONLY = process.env.E2EE_JSON === '1'
/** 本地解锁密码：crypto storageKey 的唯一可得来源（安全存储在模拟器上双失败） */
const UNLOCK_PASSWORD = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail, evidence: evidence ?? null })
  if (!JSON_ONLY) {
    const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
    console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const log = (...a) => {
  if (!JSON_ONLY) console.log(...a)
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
    /* 保留原文 */
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
  const username = `dev${label}${Date.now().toString(36)}${rand(3)}`
  for (let i = 0; i < 5; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, ...r.body, accessToken: r.body.access_token }
    if (r.status === 429) {
      await sleep(1200)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 160)}`)
  }
  throw new Error('register 被限流')
}

/** ---- CDP ---- */
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.id = 0
    this.pending = new Map()
    this.logs = []
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ')
        this.logs.push({ type: msg.params.type, text: String(args).slice(0, 300) })
      }
      if (msg.method === 'Log.entryAdded') {
        this.logs.push({ type: msg.params.entry.level, text: String(msg.params.entry.text).slice(0, 300) })
      }
    })
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', () => res())
      this.ws.addEventListener('error', () => rej(new Error('CDP 连接失败')))
    })
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      this.id += 1
      this.pending.set(this.id, { resolve, reject })
      this.ws.send(JSON.stringify({ id: this.id, method, params }))
    })
  }

  async eval(expression, { awaitPromise = true } = {}) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    }
    return res.result?.value
  }

  close() {
    this.ws.close()
  }
}

async function pickPage() {
  const res = await fetch(`${CDP}/json/list`)
  const list = await res.json()
  const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  if (!pages.length) throw new Error('没有 page target：WebView 调试未开启')
  return pages.find((t) => t.url.includes('tauri.localhost')) ?? pages[0]
}

/**
 * 确保「本地解锁密码」已配置且本次会话已解锁。
 *
 * 为什么必须先做：`getOrCreateCryptoStorageKey()` 的三级顺序是
 * 安全存储 → 本地解锁派生 → null。实测 Android 模拟器上安全存储**双双失败**
 * （keychain 回退文件也失败，见 logcat 的 `Both keychain and fallback failed`），
 * 于是只剩「本地解锁」这一条路；未解锁就直接 fail-closed，crypto 不初始化 ⇒
 * 设备密钥不上报 ⇒ 加密房里的消息永远是明文/发不出。
 */
async function ensureLocalUnlock(cdp, password) {
  const before = await cdp.eval(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      return { configured: m.isLocalUnlockConfigured(), unlocked: m.isLocalUnlockUnlocked() };
    })()
  `)
  if (before?.unlocked) return { ...before, action: 'already-unlocked' }
  if (before?.configured) {
    const ok = await cdp.eval(`
      (async () => {
        const m = await import('/src/services/secure/localUnlockKey.ts');
        const ok = await m.unlockLocalUnlock(${JSON.stringify(password)});
        return { ok, keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
      })()
    `)
    return { ...before, action: 'unlocked', ...ok }
  }
  const created = await cdp.eval(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      await m.configureLocalUnlock(${JSON.stringify(password)});
      return { configured: m.isLocalUnlockConfigured(), keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
    })()
  `)
  return { ...before, action: 'configured', ...created }
}

/** 已登录时先登出：crypto 初始化挂在登录流程上，不重登就不会重跑 */
async function logoutIfSignedIn(cdp) {
  const href = await cdp.eval('location.href')
  if (href.includes('/login')) return { wasSignedIn: false, href }
  const out = await cdp.eval(`
    (async () => {
      const app = document.querySelector('#app')?.__vue_app__;
      const pinia = app?.config?.globalProperties?.$pinia;
      const store = pinia?._s?.get?.('matrix');
      if (!store?.logout) return { ok: false, reason: '拿不到 matrix store.logout' };
      await store.logout();
      return { ok: true };
    })()
  `)
  for (let i = 0; i < 20; i += 1) {
    await sleep(1000)
    const now = await cdp.eval('location.href')
    if (now.includes('/login')) return { wasSignedIn: true, href: now, ...out }
  }
  // 实测：`logout()` 会停掉 client，但移动端路由**不会**自动跳登录页（页面停在
  // `/mobile/message` 显示「暂无会话」）。必须显式 SPA 导航 —— 不能用 location.href，
  // 整页刷新会把内存里的解锁态清掉，crypto 又回到 fail-closed。
  const nav = await cdp.eval(`
    (() => {
      const router = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
      if (!router) return { ok: false, reason: '拿不到 $router' };
      router.push({ name: 'mobileLogin' }).catch(() => {});
      return { ok: true };
    })()
  `)
  await sleep(3000)
  return { wasSignedIn: true, href: await cdp.eval('location.href'), navigated: nav, ...out }
}

/** 在真机 WebView 里用 DOM 事件填表登录（不是注入 token，走真实登录链路） */
async function loginViaUi(cdp, { username, password, serverUrl }) {
  const fill = `
    (() => {
      const setVal = (el, v) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return el.value;
      };
      const inputs = [...document.querySelectorAll('input')];
      const byPh = (ph) => inputs.find((i) => (i.placeholder || '').includes(ph));
      const server = byPh('服务器地址');
      const account = byPh('账号');
      const pwd = inputs.find((i) => i.type === 'password');
      if (!account || !pwd) return { ok: false, reason: '找不到账号/密码输入框', inputs: inputs.map(i => i.placeholder) };
      const filled = {
        server: server ? setVal(server, ${JSON.stringify(serverUrl)}) : '(跳过)',
        account: setVal(account, ${JSON.stringify(username)}),
        password: setVal(pwd, ${JSON.stringify(password)})
      };
      return { ok: true, filled };
    })()
  `
  const filled = await cdp.eval(fill)
  if (!filled?.ok) return { ok: false, reason: filled?.reason ?? '填表失败', filled }

  // 勾选协议（如果未勾）
  await cdp.eval(`
    (() => {
      const cb = document.querySelector('.van-checkbox__icon:not(.van-checkbox__icon--checked)');
      if (cb) cb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })()
  `)

  const clicked = await cdp.eval(`
    (() => {
      const btn = [...document.querySelectorAll('button, .van-button')]
        .find((b) => (b.innerText || '').trim() === '登录');
      if (!btn) return { ok: false, reason: '找不到登录按钮' };
      btn.click();
      return { ok: true };
    })()
  `)
  if (!clicked?.ok) return { ok: false, reason: clicked?.reason ?? '点击失败' }

  // 等路由离开登录页
  for (let i = 0; i < 40; i += 1) {
    await sleep(1000)
    const href = await cdp.eval('location.href')
    if (!href.includes('/login')) return { ok: true, href }
  }
  const href = await cdp.eval('location.href')
  const toast = await cdp.eval(`
    [...document.querySelectorAll('.van-toast, .van-notify, .n-message')].map(e => (e.innerText || '').trim()).join(' | ')
  `)
  return { ok: false, reason: `仍停在登录页（${href}）${toast ? '，提示：' + toast : ''}`, href }
}

async function main() {
  const started = Date.now()
  log(`\n== E2EE 真机（CDP） base=${BASE} cdp=${CDP} ==\n`)
  let cdp = null
  let roomId = null
  let a = null
  let b = null

  try {
    // ── D0 环境
    const page = await pickPage()
    cdp = new Cdp(page.webSocketDebuggerUrl)
    await cdp.ready
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    const ua = await cdp.eval('navigator.userAgent')
    record('D0', 'CDP 已连上真机 WebView', 'pass', page.url, { ua: String(ua).slice(0, 90) })

    // ── 准备账号与加密房（宿主侧 REST，避免依赖 UI 建房）
    a = await register('a')
    b = await register('b')
    const create = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.accessToken,
      body: {
        name: `e2ee-device-${Date.now().toString(36)}`,
        preset: 'private_chat',
        invite: [b.user_id],
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' }
          }
        ]
      }
    })
    if (create.status !== 200) throw new Error(`createRoom 失败 ${create.status} ${create.raw.slice(0, 160)}`)
    roomId = create.body.room_id
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.accessToken, body: {} })
    record('D0', '加密房与双账号就绪', 'pass', `${roomId} · ${a.user_id} / ${b.user_id}`)

    // ── D1a 本地解锁（crypto storageKey 的唯一可得来源，见 ensureLocalUnlock 注释）
    const unlock = await ensureLocalUnlock(cdp, UNLOCK_PASSWORD)
    record(
      'D1',
      '本地解锁就绪',
      unlock.keyLen === 32 ? 'pass' : 'fail',
      `${unlock.action}（configured=${unlock.configured}），storageKey=${unlock.keyLen ?? 0} 字节`,
      unlock
    )

    // ── D1b 先登出再登录：crypto 初始化挂在登录流程上，不重登不会重跑
    const logout = await logoutIfSignedIn(cdp)
    record('D1', '前置登出（保证走真实登录链路）', logout.ok === false ? 'fail' : 'pass', logout.wasSignedIn ? '原本已登录，已登出' : '本来就在登录页', logout)

    // ── D1 真机登录
    const login = await loginViaUi(cdp, { username: a.username, password: PASSWORD, serverUrl: BASE })
    record('D1', '真机 WebView 内登录', login.ok ? 'pass' : 'fail', login.ok ? login.href : login.reason, login.filled ?? null)
    if (!login.ok) throw new Error('登录失败，后续阶段无意义')

    // ── D2 crypto 状态
    await sleep(3000)
    const localState = await cdp.eval(`
      (() => {
        const keys = Object.keys(localStorage);
        const marker = keys.filter((k) => /unlock|crypto|secret|session|token/i.test(k));
        const dump = {};
        for (const k of marker) { try { dump[k] = String(localStorage.getItem(k)).slice(0, 60); } catch {} }
        return { url: location.href, keys, marker: dump };
      })()
    `)
    record(
      'D2',
      '本地存储标记位',
      'info',
      `${localState.keys.length} 个键，命中 ${Object.keys(localState.marker).length} 个`,
      localState.marker
    )

    const hasUnlockKey = Object.keys(localState.marker).some((k) => /unlock/i.test(k))
    record(
      'D2',
      '本地解锁 verifier 已落盘',
      hasUnlockKey ? 'pass' : 'fail',
      hasUnlockKey ? '存在解锁标记（冷启动需重新输入密码）' : '无解锁标记'
    )

    // crypto 初始化结果：读客户端暴露的调试状态（若无该入口则退回 console 日志判断）
    const cryptoState = await cdp.eval(`
      (() => {
        const app = document.querySelector('#app')?.__vue_app__;
        const gp = app?.config?.globalProperties ?? {};
        const candidates = ['$matrixClient', '$matrix', '$cryptoDebug'];
        const out = {};
        for (const c of candidates) if (gp[c]) out[c] = 'present';
        return { hasApp: Boolean(app), globals: out, pinia: Boolean(gp.$pinia) };
      })()
    `)
    record('D2', '可观测入口', 'info', JSON.stringify(cryptoState.globals), cryptoState)

    await sleep(5000)
    const cryptoLogs = cdp.logs.filter((l) => /crypto|storageKey|fail-closed|unlock/i.test(l.text))
    record(
      'D2',
      'crypto 相关 console 日志',
      cryptoLogs.length ? 'info' : 'info',
      `${cryptoLogs.length} 条`,
      cryptoLogs.slice(-6)
    )
    const failClosed = cdp.logs.some((l) => /未获取到 crypto storageKey|fail-closed/i.test(l.text))
    record(
      'D2',
      'crypto 是否 fail-closed',
      failClosed ? 'fail' : 'pass',
      failClosed ? '日志出现「未获取到 crypto storageKey，已拒绝初始化」' : '未观察到 fail-closed 日志'
    )

    // ── D3 客户端是否自己上报 device_keys（E2EE 的必要条件）
    let reported = null
    for (let i = 0; i < 12; i += 1) {
      const q = await rest('POST', '/_matrix/client/v3/keys/query', {
        token: a.access_token ?? a.accessToken,
        body: { device_keys: { [a.user_id]: [] } }
      })
      const devices = q.body?.device_keys?.[a.user_id] ?? {}
      const mine = Object.values(devices).find((d) => d && d.keys)
      if (mine) {
        reported = { count: Object.keys(devices).length, keys: Object.keys(mine.keys ?? {}) }
        break
      }
      await sleep(2500)
    }
    record(
      'D3',
      '真机客户端上传 device_keys',
      reported ? 'pass' : 'fail',
      reported ? `${reported.count} 个设备，密钥 ${reported.keys.join(',')}` : '30s 内服务端没有该设备的 device_keys ⇒ crypto 未初始化',
      reported
    )

    // ── D4 进加密房发消息（导航用 SPA router，避免整页刷新丢内存态）
    const nav = await cdp.eval(`
      (() => {
        const app = document.querySelector('#app')?.__vue_app__;
        const router = app?.config?.globalProperties?.$router;
        if (!router) return { ok: false, reason: '拿不到 $router' };
        router.push({ name: 'mobileChatMain', params: { roomId: ${JSON.stringify(roomId)} } }).catch(() => {});
        return { ok: true };
      })()
    `)
    record('D4', '导航到加密房', nav?.ok ? 'pass' : 'fail', nav?.ok ? roomId : nav?.reason)
    await sleep(6000)

    const composer = await cdp.eval(`
      (() => {
        const tas = [...document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')];
        return tas.map((e) => ({ tag: e.tagName, ph: e.placeholder || '', cls: String(e.className).slice(0, 40) }));
      })()
    `)
    record('D4', '输入区候选元素', 'info', `${composer.length} 个`, composer)

    const sent = await cdp.eval(`
      (() => {
        const el = [...document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]')]
          .find((e) => !String(e.className).includes('van-field__control') || (e.placeholder || '').length >= 0);
        if (!el) return { ok: false, reason: '没有输入框' };
        const text = 'e2ee-device-' + Date.now();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
          setter.call(el, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          el.innerText = text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }
        // 找发送按钮：aria-label 或 svg use#send
        const btn = [...document.querySelectorAll('[aria-label], button, [role="button"]')]
          .find((b) => /发送|send/i.test(b.getAttribute?.('aria-label') || b.innerText || ''));
        if (btn) { btn.click(); return { ok: true, text, via: 'button' }; }
        // 退化：回车
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        return { ok: true, text, via: 'enter' };
      })()
    `)
    record('D4', '发送一条消息', sent?.ok ? 'pass' : 'fail', sent?.ok ? `${sent.via}: ${sent.text}` : sent?.reason)
    await sleep(8000)

    const msgs = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=15`, {
      token: a.accessToken
    })
    const chunk = msgs.body?.chunk ?? []
    const encrypted = chunk.filter((e) => e.type === 'm.room.encrypted')
    const plain = chunk.filter((e) => e.type === 'm.room.message')
    record(
      'D4',
      '服务端收到的形态',
      encrypted.length ? 'pass' : 'fail',
      `encrypted=${encrypted.length} 条，plaintext=${plain.length} 条${plain.length ? '（加密房里出现明文 = 客户端没加密）' : ''}`,
      {
        encrypted: encrypted.slice(0, 2).map((e) => ({ algorithm: e.content?.algorithm, session_id: e.content?.session_id?.slice(0, 8) })),
        plaintext: plain.slice(0, 2).map((e) => ({ body: e.content?.body?.slice(0, 40) }))
      }
    )

    // ── D5 对方发一条，真机能否渲染
    const bSend = await rest(
      'PUT',
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${Date.now()}`,
      { token: b.accessToken, body: { msgtype: 'm.text', body: `from-b-${Date.now().toString(36)}` } }
    )
    record('D5', 'B 侧发一条', bSend.status === 200 ? 'pass' : 'fail', `status=${bSend.status}`)
    await sleep(6000)
    const rendered = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const m = text.match(/from-b-[a-z0-9]+/);
        return { found: m ? m[0] : null, bodyLen: text.length };
      })()
    `)
    record(
      'D5',
      '真机渲染对端消息',
      rendered?.found ? 'pass' : 'fail',
      rendered?.found ? `页面上出现 ${rendered.found}` : '页面上没有该消息（加密房未解密 或 未同步）',
      rendered
    )

    // ── 汇总日志
    const errors = cdp.logs.filter((l) => l.type === 'error')
    record('D9', '页面错误日志', errors.length ? 'fail' : 'pass', `${errors.length} 条`, errors.slice(-5).map((e) => e.text))
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    if (cdp) cdp.close()
  }

  const summary = {
    base: BASE,
    durationMs: Date.now() - started,
    pass: results.filter((r) => r.level === 'pass').length,
    fail: results.filter((r) => r.level === 'fail').length,
    roomId,
    account: a ? { userId: a.user_id, username: a.username, password: PASSWORD } : null,
    results
  }
  if (JSON_ONLY) console.log(JSON.stringify(summary, null, 2))
  else log(`\n== 汇总：${summary.pass} passed / ${summary.fail} failed，${(summary.durationMs / 1000).toFixed(1)}s ==`)
  process.exitCode = summary.fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本自身异常:', e)
  process.exitCode = 2
})
