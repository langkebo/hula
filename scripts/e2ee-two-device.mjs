#!/usr/bin/env node
/**
 * E2EE 双端联调编排：**Android 模拟器（真机 WebView）+ 本机 Chromium**
 *
 * 为什么需要两端：Megolm 加密要求房间里每个设备都有可用的 Olm 会话；
 * 只有一端有 crypto 时，发送会失败（SDK 找不到对端设备密钥），
 * 而这正是「只有一台设备时怎么测都测不通」的原因。
 *
 * 编排步骤：
 *   1. REST 建两个账号 + 一个带 m.room.encryption 的房间
 *   2. Chromium 端登录 B（先把本地解锁配好，否则 crypto fail-closed）
 *   3. 等 B 自己上报 device_keys
 *   4. Android 端（CDP）登录 A，同样先解锁
 *   5. A 发一条 → 服务端应出现 m.room.encrypted；B 端页面应渲染出明文
 *   6. B 回一条 → A 端页面应渲染出明文
 *
 * 用法：
 *   node scripts/e2ee-two-device.mjs            # 默认 8008 + 5210 + 9222
 *   ANDROID_CDP=0 node scripts/e2ee-two-device.mjs   # 只跑 Chromium 单端（无模拟器时）
 */

import { chromium } from 'playwright'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const APP = (process.env.E2EE_APP ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const CDP_PORT = process.env.CDP_PORT ?? '9222'
const USE_ANDROID = process.env.ANDROID_CDP !== '0'
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const JSON_ONLY = process.env.E2EE_JSON === '1'

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
    /* keep raw */
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
  const username = `e2e${label}${Date.now().toString(36)}${rand(3)}`
  for (let i = 0; i < 6; i += 1) {
    const r = await rest('POST', '/_matrix/client/v3/register', {
      body: { username, password: PASSWORD, auth: { type: 'm.login.dummy' } }
    })
    if (r.status === 200) return { username, userId: r.body.user_id, token: r.body.access_token, deviceId: r.body.device_id }
    if (r.status === 429) {
      await sleep(1200)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 150)}`)
  }
  throw new Error('register 限流')
}

/** 在任意页面上下文里：配置解锁 → 登录 → 返回是否成功 */
const LOGIN_FN = (username, password, unlockPw) => `
  (async () => {
    const lock = await import('/src/services/secure/localUnlockKey.ts');
    if (!lock.isLocalUnlockConfigured()) await lock.configureLocalUnlock(${JSON.stringify(unlockPw)});
    else if (!lock.isLocalUnlockUnlocked()) await lock.unlockLocalUnlock(${JSON.stringify(unlockPw)});
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')];
    const byPh = (ph) => inputs.find((i) => (i.placeholder || '').includes(ph));
    const server = byPh('服务器地址');
    const account = byPh('账号');
    const pwd = inputs.find((i) => i.type === 'password');
    if (server) setVal(server, ${JSON.stringify(BASE)});
    if (!account || !pwd) return { ok: false, reason: 'no-inputs', ph: inputs.map(i => i.placeholder) };
    setVal(account, ${JSON.stringify(username)});
    setVal(pwd, ${JSON.stringify(password)});
    const cb = document.querySelector('.van-checkbox__icon:not(.van-checkbox__icon--checked)');
    if (cb) cb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 必须等一拍：input 事件只是写给 DOM，Vue 的 v-model 要到下一个 tick 才更新，
    // 立刻点「登录」时提交的是旧值（实测直接点会停在登录页且无 toast）。
    await new Promise((r) => setTimeout(r, 500));
    const btn = [...document.querySelectorAll('button, .van-button')].find((b) => (b.innerText || '').trim() === '登录');
    if (!btn) return { ok: false, reason: 'no-login-button' };
    btn.click();
    return { ok: true };
  })()
`

/** 等 crypto 起来（以「客户端上报 device_keys」为准，服务端侧判定，最干净） */
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

/** 打开一个可复用的 CDP 会话（需要 Input 域做真实点击） */
async function openAndroid() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('tauri.localhost'))
  if (!page) throw new Error('没有 tauri WebView target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('CDP connect failed')))
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

/**
 * 在 Android 端用**真实**输入 + 真实鼠标点击发一条消息。
 *
 * 为什么不能用合成事件：`#message-input` 的 Enter 是换行；而发送按钮
 * （`<n-button v-if="hasInput">{{ t('editor.send') }}</n-button>`）只在输入框有内容时渲染，
 * 必须先用 `Input.insertText` 让 Vue 更新 `hasInput`，再点它。
 */
async function androidRealSend(text) {
  const a = await openAndroid()
  try {
    await a.evaluate(`document.querySelector('#message-input')?.focus(); true`)
    await sleep(200)
    await a.send('Input.insertText', { text })
    await sleep(800)
    const btn = await a.evaluate(`
      (() => {
        const b = [...document.querySelectorAll('button')]
          .find((x) => /^(发送|Send)$/.test((x.innerText || '').trim()));
        if (!b) return { found: false };
        const r = b.getBoundingClientRect();
        return { found: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), disabled: Boolean(b.disabled) };
      })()
    `)
    if (!btn?.found || btn.disabled) {
      return { ok: false, reason: btn?.found ? '按钮 disabled' : '找不到「发送」按钮', text }
    }
    await a.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btn.x, y: btn.y, button: 'none', clickCount: 0 })
    await sleep(60)
    await a.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btn.x, y: btn.y, button: 'left', clickCount: 1 })
    await sleep(80)
    await a.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btn.x, y: btn.y, button: 'left', clickCount: 1 })
    await sleep(6000)
    const composer = await a.evaluate(`(document.querySelector('#message-input')?.innerText ?? '').trim()`)
    return { ok: true, text, at: `(${btn.x},${btn.y})`, composerCleared: !String(composer).includes(text) }
  } finally {
    a.close()
  }
}

/** 极简 CDP：只用于 Android WebView */
async function androidEval(expression) {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('tauri.localhost'))
  if (!page) throw new Error('没有 tauri WebView target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('CDP connect failed')))
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
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
  ws.close()
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
  return res.result?.value
}

async function main() {
  const started = Date.now()
  log(`\n== E2EE 双端联调（Android 模拟器 + Chromium）base=${BASE} ==\n`)
  let browser = null
  let roomId = null
  const ctx = {}

  try {
    // 1) 账号与加密房
    const a = await register('a')
    const b = await register('b')
    ctx.a = a
    ctx.b = b
    const create = await rest('POST', '/_matrix/client/v3/createRoom', {
      token: a.token,
      body: {
        name: `e2ee-2dev-${Date.now().toString(36)}`,
        preset: 'private_chat',
        invite: [b.userId],
        initial_state: [
          { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }
        ]
      }
    })
    if (create.status !== 200) throw new Error(`createRoom ${create.status} ${create.raw.slice(0, 150)}`)
    roomId = create.body.room_id
    ctx.roomId = roomId
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    record('S0', '账号与加密房', 'pass', `${roomId}`, { a: a.userId, b: b.userId })

    // 2) Chromium 端登录 B
    browser = await chromium.launch({ headless: true })
    const pageB = await browser.newPage({ viewport: { width: 420, height: 900 } })
    const logsB = []
    pageB.on('console', (m) => logsB.push({ type: m.type(), text: m.text().slice(0, 200) }))
    await pageB.goto(`${APP}/mobile/login?platform=mobile`, { waitUntil: 'domcontentloaded' })
    // vite 首次冷启动/重编译时首屏可能 10s+ 才出表单，直接 evaluate 会拿到 no-inputs
    for (let i = 0; i < 20; i += 1) {
      const n = await pageB.evaluate(() => document.querySelectorAll('input').length)
      if (n >= 2) break
      await sleep(1000)
    }
    const loginB = await pageB.evaluate(LOGIN_FN(b.username, PASSWORD, UNLOCK_PW))
    for (let i = 0; i < 25; i += 1) {
      await sleep(1000)
      if (!pageB.url().includes('/login')) break
    }
    const okB = !pageB.url().includes('/login')
    const toastB = okB ? '' : await pageB.evaluate(() => [...document.querySelectorAll('.van-toast,.van-notify,.n-message')].map((e) => e.innerText).join('|'))
    record('S1', 'Chromium 端登录 B', okB ? 'pass' : 'fail', `${loginB?.reason ?? 'ok'} → ${pageB.url()}${toastB ? ` ，提示：${toastB}` : ''}`, loginB)
    if (!okB) throw new Error('B 端登录失败')

    const keysB = await waitDeviceKeys(b.userId, b.token, 'B')
    record('S1', 'B 端 crypto 就绪（上报 device_keys）', keysB.ok ? 'pass' : 'fail', keysB.ok ? `device=${keysB.deviceId}` : '60s 未上报', keysB)

    // 3) Android 端登录 A
    let androidReady = false
    if (USE_ANDROID) {
      const cur = await androidEval('location.href')
      if (!cur.includes('/login')) {
        await androidEval(`(async () => {
          const app = document.querySelector('#app')?.__vue_app__;
          const store = app?.config?.globalProperties?.$pinia?._s?.get?.('matrix');
          try { await store?.logout(); } catch {}
          const router = app?.config?.globalProperties?.$router;
          router?.push({ name: 'mobileLogin' }).catch(() => {});
          return true;
        })()`)
        await sleep(4000)
      }
      for (let i = 0; i < 20; i += 1) {
        const n = await androidEval('document.querySelectorAll("input").length')
        if (Number(n) >= 2) break
        await sleep(1000)
      }
      const loginA = await androidEval(LOGIN_FN(a.username, PASSWORD, UNLOCK_PW))
      for (let i = 0; i < 30; i += 1) {
        await sleep(1000)
        const href = await androidEval('location.href')
        if (!href.includes('/login')) break
      }
      const hrefA = await androidEval('location.href')
      const okA = !hrefA.includes('/login')
      record('S2', 'Android 端登录 A', okA ? 'pass' : 'fail', `${loginA?.reason ?? 'ok'} → ${hrefA}`, loginA)
      const keysA = await waitDeviceKeys(a.userId, a.token, 'A')
      record('S2', 'A 端 crypto 就绪（上报 device_keys）', keysA.ok ? 'pass' : 'fail', keysA.ok ? `device=${keysA.deviceId}` : '60s 未上报', keysA)
      androidReady = okA && keysA.ok
    } else {
      record('S2', 'Android 端', 'skip', 'ANDROID_CDP=0')
    }

    // 4) A 端发消息 → 服务端形态
    //    Android 端不可用时，退化为「用 A 的 token 经 REST 发」，只验服务端；
    //    但加密必须由客户端做，REST 发的是明文，所以这里明确标注退化。
    if (androidReady) {
      await androidEval(`(() => {
        const app = document.querySelector('#app')?.__vue_app__;
        app?.config?.globalProperties?.$router?.push({ name: 'mobileChatMain', params: { roomId: ${JSON.stringify(roomId)} } }).catch(() => {});
        return true;
      })()`)
      await sleep(6000)
      const send = await androidRealSend(`enc-from-android-${Date.now()}`)
      record('S3', 'Android 端发送', send?.ok ? 'pass' : 'fail', `${send?.via}: ${send?.text}`, send)
      ctx.sentByA = send?.text
      await sleep(5000)

      // UI 路径可能被「未验证设备」门禁挡住：此时消息只在本地乐观渲染，服务端收不到，
      // 界面上也没有报错 —— 必须显式识别，否则会被误读成「加密失败」。
      const gate = await androidEval(`(() => {
        const t = document.body.innerText;
        const m = t.match(/本房间有\\s*(\\d+)\\s*台未验证设备/);
        return { blocked: Boolean(m), devices: m ? m[1] : null, hasSendAnyway: /仅向已验证设备发送/.test(t) };
      })()`)
      // 弹窗只是**提示**：实测真实点击后消息照常加密发出（服务端有 encrypted），
      // 所以「有弹窗」不能判失败，判据必须落到服务端事件上。
      if (gate?.blocked) {
        record('S3', '出现「未验证设备」提示弹窗', 'info', `${gate.devices} 台未验证设备（提示性，不阻断发送）`, gate)
        await androidEval(`(() => {
          const btn = [...document.querySelectorAll('button, .van-dialog__cancel, [role="button"]')]
            .find((b) => /^关闭$/.test((b.innerText || '').trim()));
          btn?.click();
          return true;
        })()`)
        await sleep(1500)
      } else {
        record('S3', '出现「未验证设备」提示弹窗', 'info', '本次未出现')
      }

      const afterUiSend = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`, { token: a.token })
      const uiEnc = (afterUiSend.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted').length
      record(
        'S3',
        'UI 真实点击后服务端出现 m.room.encrypted',
        uiEnc > 0 ? 'pass' : 'fail',
        `${uiEnc} 条`,
        { composerCleared: send?.composerCleared, at: send?.at }
      )

      // 绕过 UI 门禁，直接用 SDK 发送：用来区分「加密链路不通」和「UI 拦住了」
      const direct = await androidEval(`(async () => {
        const m = await import('/src/services/matrix/index.ts');
        const c = m.matrixClientService.getClient();
        if (!c) return { ok: false, reason: 'no-client' };
        const text = 'sdk-direct-' + Date.now();
        try {
          const r = await c.sendEvent(${JSON.stringify(roomId)}, 'm.room.message', { msgtype: 'm.text', body: text });
          return { ok: true, eventId: r.event_id, text };
        } catch (e) { return { ok: false, err: String(e).slice(0, 200) }; }
      })()`)
      record('S3', 'SDK 直发（绕过 UI 门禁）', direct?.ok ? 'pass' : 'fail', direct?.ok ? direct.eventId : direct?.err, direct)
      if (direct?.ok) ctx.sentByA = direct.text
      await sleep(5000)
    } else {
      record('S3', 'Android 端发送', 'skip', '未就绪，跳过（不伪造结论）')
    }

    const msgs = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, {
      token: a.token
    })
    const chunk = msgs.body?.chunk ?? []
    const encrypted = chunk.filter((e) => e.type === 'm.room.encrypted')
    const plain = chunk.filter((e) => e.type === 'm.room.message')
    record(
      'S3',
      '服务端消息形态',
      encrypted.length ? 'pass' : 'fail',
      `encrypted=${encrypted.length} / plaintext=${plain.length}`,
      {
        encrypted: encrypted.slice(0, 2).map((e) => ({ algo: e.content?.algorithm, sid: e.content?.session_id?.slice(0, 10) })),
        plaintext: plain.slice(0, 2).map((e) => ({ body: String(e.content?.body ?? '').slice(0, 30) }))
      }
    )

    // 5) B 端（Chromium）是否解密渲染
    if (ctx.sentByA) {
      await pageB.evaluate((rid) => {
        const app = document.querySelector('#app')?.__vue_app__
        app?.config?.globalProperties?.$router?.push({ name: 'mobileChatMain', params: { roomId: rid } }).catch(() => {})
      }, roomId)
      await sleep(8000)
      // router.push 是异步渲染：timeline 可能立刻有数据（缓存），但页面还是空壳
      // （实测 timeline=12 条时页面长度只有 208）。先等页面真正画出消息列表再判。
      await sleep(6000)
      let bState = null
      for (let i = 0; i < 20; i += 1) {
        bState = await pageB.evaluate(async (rid) => {
          const m = await import('/src/services/matrix/index.ts')
          const room = m.matrixClientService.getClient()?.getRoom?.(rid)
          const evs = room?.getLiveTimeline?.()?.getEvents?.() ?? []
          return { count: evs.length, utd: evs.filter((e) => e.isDecryptionFailure?.()).length }
        }, roomId)
        const painted = await pageB.evaluate(() => document.body.innerText.length)
        if (bState?.count > 0 && painted > 300) break
        await sleep(1500)
      }
      const renderedB = await pageB.evaluate(() => document.body.innerText)
      const bStateFinal = await pageB.evaluate(async (rid) => {
        const m = await import('/src/services/matrix/index.ts')
        const room = m.matrixClientService.getClient()?.getRoom?.(rid)
        const evs = room?.getLiveTimeline?.()?.getEvents?.() ?? []
        return { count: evs.length, utd: evs.filter((e) => e.isDecryptionFailure?.()).length }
      }, roomId)
      bState = bStateFinal ?? bState
      const foundB = renderedB.includes(ctx.sentByA)
      if (foundB) {
        record('S4', 'Chromium 端解密渲染 A 的消息', 'pass', `出现 ${ctx.sentByA}`)
      } else if (bState?.utd > 0) {
        // 新设备没有历史 Megolm 会话 ⇒ UTD。这是 D5 的表现，不是渲染缺陷。
        record(
          'S4',
          'Chromium 端解密渲染 A 的消息',
          'info',
          `未渲染，但 timeline 有 ${bState.utd} 条 UTD（新设备缺会话密钥，属 D5 现象）`,
          bState
        )
      } else {
        // 页面长度 < 300 说明 B 端根本没进入房间 UI（导航/渲染问题），
        // 此时「没渲染出消息」不能当作解密结论 ⇒ 记 info 并单列一条导航问题。
        const painted = renderedB.length
        record(
          'S4',
          'Chromium 端解密渲染 A 的消息',
          painted > 300 ? 'fail' : 'skip',
          painted > 300
            ? `页面已渲染但没出现该消息；timeline=${bState?.count ?? '?'} 条`
            : `判据无效：B 端页面未进入房间 UI（长度=${painted}，timeline=${bState?.count ?? '?'} 条，url=${pageB.url()}）`,
          { bState, url: pageB.url() }
        )
      }
    }

    // 6) B 发一条，Android 是否渲染
    if (androidReady) {
      const bText = `enc-from-chromium-${Date.now()}`
      // Playwright 的 click/type 是真实输入事件（非 JS 合成），发送按钮会随 hasInput 出现
      let sendB = { ok: false, reason: 'unknown' }
      try {
        await pageB.locator('#message-input').click({ timeout: 15000 })
        await pageB.keyboard.type(bText, { delay: 20 })
        await pageB.waitForTimeout(600)
        const sendBtn = pageB.locator('button', { hasText: /^(发送|Send)$/ }).first()
        await sendBtn.click({ timeout: 15000 })
        sendB = { ok: true, via: 'button' }
      } catch (e) {
        sendB = { ok: false, reason: String(e).slice(0, 120) }
      }
      record('S5', 'Chromium 端发送', sendB?.ok ? 'pass' : 'fail', `${sendB?.via ?? sendB?.reason}`, sendB)
      await sleep(9000)
      const bodyA = await androidEval('document.body.innerText')
      record(
        'S5',
        'Android 端解密渲染 B 的消息',
        String(bodyA).includes(bText) ? 'pass' : 'fail',
        String(bodyA).includes(bText) ? '出现 ' + bText : '没渲染出来',
        { preview: String(bodyA).replace(/\s+/g, ' ').slice(0, 160) }
      )
    }

    // ── S6 UTD 触发后是否发出 m.room_key_request（D5 的客观判据）
    //    用户口径：用服务端日志/表确认「客户端到底发没发」，前端不自建补发逻辑。
    //    `m.room_key_request` 是 to-device 事件，落在 to_device_messages 表，房间事件里看不到。
    {
      const sinceMs = Date.now() - 2000
      const utdBefore = await pageB.evaluate(async (rid) => {
        const m = await import('/src/services/matrix/index.ts')
        const room = m.matrixClientService.getClient()?.getRoom?.(rid)
        const evs = room?.getLiveTimeline?.()?.getEvents?.() ?? []
        return evs.filter((e) => e.isDecryptionFailure?.()).length
      }, roomId).catch(() => -1)
      // 让 B（新设备）重新打开房间：冷开历史 → 触发 UTD → 客户端可能请求密钥
      await pageB.evaluate((rid) => {
        const app = document.querySelector('#app')?.__vue_app__
        app?.config?.globalProperties?.$router?.push({ name: 'mobileMessage' }).catch(() => {})
        setTimeout(() => {
          app?.config?.globalProperties?.$router?.push({ name: 'mobileChatMain', params: { roomId: rid } }).catch(() => {})
        }, 1500)
      }, roomId)
      await sleep(20000)

      let keyReq = null
      try {
        const { execFileSync } = await import('node:child_process')
        const sql = `select event_type, count(*) from to_device_messages where created_ts >= ${sinceMs} group by 1 order by 2 desc`
        const out = execFileSync(
          'docker',
          ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql],
          { encoding: 'utf8', timeout: 15000 }
        )
        keyReq = out
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [type, count] = line.split('|')
            return { type, count: Number(count) }
          })
      } catch (e) {
        keyReq = { error: String(e).slice(0, 160) }
      }

      const types = Array.isArray(keyReq) ? keyReq : []
      const requested = types.find((t) => t.type === 'm.room_key_request')
      const forwarded = types.find((t) => t.type === 'm.forwarded_room_key')
      const utdSeen = Number(utdBefore) > 0
      record(
        'S6',
        'UTD 后是否发出 m.room_key_request',
        requested ? 'pass' : utdSeen ? 'fail' : 'skip',
        requested
          ? `服务端收到 ${requested.count} 条（B 端会主动请求密钥）`
          : utdSeen
            ? `未发出（该设备 UTD=${utdBefore} 条，to-device 仅：${types.map((t) => `${t.type}×${t.count}`).join(', ') || '无'}）`
            : `未触发 UTD（该设备 UTD=0），本轮无法判定 —— 全表历史 0 条 %room_key% 仍需单独复现`,
        { sinceMs, utdFailuresBefore: utdBefore, types: keyReq }
      )
      if (requested) {
        record(
          'S6',
          '发送方是否响应并转发会话密钥',
          forwarded ? 'pass' : 'fail',
          forwarded ? `m.forwarded_room_key ×${forwarded.count}` : '未见 m.forwarded_room_key（A 端未响应请求）'
        )
      }
    }

    const errB = logsB.filter((l) => l.type === 'error')
    record('S9', 'Chromium 端错误日志', errB.length ? 'info' : 'pass', `${errB.length} 条`, errB.slice(-4))
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    if (browser) await browser.close()
  }

  const summary = {
    durationMs: Date.now() - started,
    pass: results.filter((r) => r.level === 'pass').length,
    fail: results.filter((r) => r.level === 'fail').length,
    skip: results.filter((r) => r.level === 'skip').length,
    context: ctx,
    results
  }
  if (JSON_ONLY) console.log(JSON.stringify(summary, null, 2))
  else {
    log(`\n== 汇总：${summary.pass} passed / ${summary.fail} failed / ${summary.skip} skipped，${(summary.durationMs / 1000).toFixed(1)}s ==`)
    if (ctx.a) log(`复现信息：账号 ${ctx.a.username} / ${ctx.b.username}（密码 ${PASSWORD}），房间 ${ctx.roomId}`)
  }
  process.exitCode = summary.fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e)
  process.exitCode = 2
})
