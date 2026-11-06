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
      const send = await androidEval(`(async () => {
        const box = [...document.querySelectorAll('textarea, [contenteditable="true"], .n-input')]
          .find((e) => e.offsetParent !== null && !String(e.className).includes('van-field__control'));
        if (!box) return { ok: false, reason: 'no-composer' };
        const text = 'enc-from-android-' + Date.now();
        const target = box.querySelector?.('textarea, [contenteditable="true"]') ?? box;
        target.focus();
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value').set;
          setter.call(target, text);
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          target.innerText = text;
          target.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
        }
        await new Promise((r) => setTimeout(r, 600));
        const btn = [...document.querySelectorAll('[aria-label], button, [role="button"]')]
          .find((b) => /^发送$|send message/i.test((b.getAttribute?.('aria-label') || b.innerText || '').trim()));
        if (btn) { btn.click(); return { ok: true, text, via: 'button' }; }
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        return { ok: true, text, via: 'enter' };
      })()`)
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
      if (gate?.blocked) {
        record(
          'S3',
          'UI 发送被「未验证设备」门禁拦截',
          'fail',
          `${gate.devices} 台未验证设备，弹窗要求选择发送范围；未选择时消息不发且无错误提示`,
          gate
        )
        // 关掉弹窗，避免影响后续直发
        await androidEval(`(() => {
          const btn = [...document.querySelectorAll('button, .van-dialog__cancel, [role="button"]')]
            .find((b) => /^关闭$/.test((b.innerText || '').trim()));
          btn?.click();
          return true;
        })()`)
        await sleep(1500)
      } else {
        record('S3', '未验证设备门禁', 'pass', '未出现拦截弹窗')
      }

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
      const renderedB = await pageB.evaluate(() => document.body.innerText)
      const found = renderedB.includes(ctx.sentByA)
      record(
        'S4',
        'Chromium 端解密渲染 A 的消息',
        found ? 'pass' : 'fail',
        found ? `页面上出现 ${ctx.sentByA}` : '没渲染出来（可能是解密失败，也可能未同步）',
        { preview: renderedB.replace(/\s+/g, ' ').slice(0, 160) }
      )
    }

    // 6) B 发一条，Android 是否渲染
    if (androidReady) {
      const bText = `enc-from-chromium-${Date.now()}`
      const sendB = await pageB.evaluate(async (text) => {
        const box = [...document.querySelectorAll('textarea, [contenteditable="true"]')].find((e) => e.offsetParent !== null)
        if (!box) return { ok: false, reason: 'no-composer' }
        box.focus()
        if (box.tagName === 'TEXTAREA') {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
          setter.call(box, text)
          box.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
          box.innerText = text
          box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }))
        }
        await new Promise((r) => setTimeout(r, 500))
        const btn = [...document.querySelectorAll('[aria-label], button, [role="button"]')].find((b) =>
          /^发送$|send message/i.test((b.getAttribute?.('aria-label') || b.innerText || '').trim())
        )
        if (btn) {
          btn.click()
          return { ok: true, via: 'button' }
        }
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
        return { ok: true, via: 'enter' }
      }, bText)
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
