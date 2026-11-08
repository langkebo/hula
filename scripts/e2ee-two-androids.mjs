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
 * 为什么必须**串行**（2026-11-08 第二轮结论）：
 *   两台模拟器同时跑时，crypto 初始化会卡在 `attempted=true / initialized=false / error=null`
 *   —— 这不是「失败并被吞掉」，而是 `initRustCrypto()` **一直没 resolve**（WASM crypto store
 *   首次建库 + 宿主内存吃紧（16G 里只剩 ~70MB 空闲）+ 两台各 4 vCPU 抢 10 核）。
 *   于是改成阶段化：**同一时刻只有一台设备在前台做 crypto 初始化**，另一台 `am force-stop`。
 *
 * 阶段划分（关键：每个方向都必须「对端 device_keys 已上传」之后发送，密钥分发才包含对端）：
 *   S0  REST 建号 + 加密房（A 建、B join），两台 adb reverse
 *   S1  仅 A 在线 → 解锁 → 登录 → crypto 就绪 → 进房 → 发 msgA1（此时 B 还没 device_keys）
 *   S2  停 A，仅 B 在线 → 解锁 → 登录 → crypto 就绪 → 进房（msgA1 必然 UTD，D5 证据）→ 发 msgB1
 *   S3  A 冷启动回来（会话恢复 + crypto 重建）→ 解密 msgB1 ✅ → 发 msgA2 → B 解密 msgA2 ✅
 *
 * 设备约定：A `emulator-5554` / CDP 9222，B `emulator-5556` / CDP 9223。
 * 每台都要 `adb reverse tcp:5210/8008` + `adb forward <cdp> localabstract:webview_devtools_remote_<pid>`
 * （force-stop 后 pid 会变，forward 必须重建 —— 本脚本自动处理）。
 *
 * 用法：
 *   node scripts/e2ee-two-androids.mjs
 *   E2EE_SERIAL=0 node scripts/e2ee-two-androids.mjs   # 关掉串行（对照用，会复现挂起）
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const APP = (process.env.E2EE_APP ?? 'http://127.0.0.1:5210').replace(/\/$/, '')
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
/** 串行开关：默认开（关掉就是旧行为，用来复现挂起） */
const SERIAL = process.env.E2EE_SERIAL !== '0'
/** crypto 就绪等待上限：串行下实测 30–90s，留 180s 余量 */
const CRYPTO_TIMEOUT_MS = Number(process.env.E2EE_CRYPTO_TIMEOUT_MS ?? 180_000)
/** 判定「一直没 resolve」的阈值：超过就 reload 一次重试 */
const CRYPTO_STUCK_MS = Number(process.env.E2EE_CRYPTO_STUCK_MS ?? 90_000)
/**
 * 是否给 WebView 打开「localStorage 凭证回退」（默认开）。
 *
 * 为什么测试必须开：Android 上 Rust 侧 secure_store **一条都存不进去** ——
 * keychain `set_password` 返回 Ok 但 `get_password` 拿不到（`macOS dev mode ACL issue`），
 * 文件 fallback 的目录只按 `$HOME` 推导，而 Android 进程没有 `HOME`
 * （logcat：`Cannot determine fallback path` → `Both keychain and fallback failed`）。
 * 于是 token 不落盘 ⇒ 每次冷启动都要重新登录，S3「A 冷启动回来」这步无法成立。
 * 打开本开关后走我们自己的 web-fallback（`tjg:session:web-fallback=1`），
 * 同时把这条回退路径本身也纳入联调。
 * 想复现 D2（会话不持久）时传 `E2EE_WEB_FALLBACK=0`。
 */
const WEB_FALLBACK = process.env.E2EE_WEB_FALLBACK !== '0'

const ANDROID_HOME = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
const ADB =
  [process.env.ADB, `${ANDROID_HOME}/platform-tools/adb`, '/opt/homebrew/bin/adb', 'adb'].find(
    (p) => p && (p === 'adb' || existsSync(p))
  ) ?? 'adb'

const DEVICES = {
  a: { key: 'A', label: 'A(5554)', serial: 'emulator-5554', cdp: Number(process.env.CDP_A ?? 9222) },
  b: { key: 'B', label: 'B(5556)', serial: 'emulator-5556', cdp: Number(process.env.CDP_B ?? 9223) }
}

const results = []
const record = (stage, name, level, detail, evidence) => {
  results.push({ stage, name, level, detail, evidence: evidence ?? null })
  const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
  console.log(`${tag} [${stage}] ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const phase = (name) => console.log(`\n──── ${name} ────`)

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
    if (r.status === 200) {
      return { username, password: PASSWORD, userId: r.body.user_id, token: r.body.access_token, deviceId: r.body.device_id }
    }
    if (r.status === 429) {
      await sleep(1200)
      continue
    }
    throw new Error(`register ${username}: ${r.status} ${r.raw.slice(0, 150)}`)
  }
  throw new Error('register 限流')
}

/* ── adb：台账化控制两台设备 ─────────────────────────────────────────── */
function adb(device, args, { timeout = 30000 } = {}) {
  return execFileSync(ADB, ['-s', device.serial, ...args], { encoding: 'utf8', timeout }).trim()
}

function adbSoft(device, args) {
  try {
    return adb(device, args)
  } catch (e) {
    return { error: String(e.message ?? e).slice(0, 160) }
  }
}

function appPid(device) {
  const out = adbSoft(device, ['shell', 'pidof', 'com.tjg.app'])
  const pid = typeof out === 'string' ? out.split(/\s+/).filter(Boolean)[0] : null
  return pid ? Number(pid) : null
}

/** 同步睡眠（这个文件里 force-stop 后要在同步路径上等进程退出） */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function forceStopApp(device) {
  adbSoft(device, ['shell', 'am', 'force-stop', 'com.tjg.app'])
  for (let i = 0; i < 12; i += 1) {
    if (!appPid(device)) return { ok: true, waitedMs: i * 500 }
    sleepSync(500)
  }
  return { ok: false, pid: appPid(device) }
}

function ensureReverse(device) {
  for (const port of [5210, 8008]) {
    adbSoft(device, ['reverse', `tcp:${port}`, `tcp:${port}`])
  }
  const list = adbSoft(device, ['reverse', '--list'])
  return typeof list === 'string' ? list.replace(/\n/g, ' ') : String(list)
}

/** 启动 app 并重建 CDP forward（force-stop 后 pid 变化，forward 必须重做） */
async function startAppWithCdp(device) {
  adbSoft(device, ['forward', '--remove', `tcp:${device.cdp}`])
  adbSoft(device, ['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])

  let pid = null
  for (let i = 0; i < 40; i += 1) {
    pid = appPid(device)
    if (pid) break
    await sleep(1000)
  }
  if (!pid) return { ok: false, reason: '进程未起来' }

  adbSoft(device, ['forward', `tcp:${device.cdp}`, `localabstract:webview_devtools_remote_${pid}`])

  // WebView devtools socket 要等 WebView 真正创建后才出现；冷启动 + ANR 时可能 60s+
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${device.cdp}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      if (Array.isArray(list) && list.some((t) => t.type === 'page')) return { ok: true, pid, waitedMs: i * 1000 }
    } catch {
      /* forward 还没通 */
    }
    await sleep(1000)
  }
  return { ok: false, pid, reason: 'CDP target 60s 未出现（可能撞 ANR）' }
}

/* ── 每台设备一个 CDP 连接（需要 Input 域做真实点击）──────────────────── */
async function openCdp(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page =
    list.find((t) => t.type === 'page' && String(t.url).includes('tauri.localhost')) ?? list.find((t) => t.type === 'page')
  if (!page) throw new Error(`:${port} 没有 WebView target（forward 失效或 app 未起）`)
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
  const before = await cdp
    .evaluate(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      return { configured: m.isLocalUnlockConfigured(), unlocked: m.isLocalUnlockUnlocked(), keyLen: m.getLocalUnlockStorageKey()?.length ?? 0 };
    })()
  `)
    .catch(() => ({ error: 'import failed' }))
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

/** 冷启动解锁弹窗 → 填密码 → 点「解锁」（弹窗可能十几秒后才出现，要等） */
async function passUnlockDialog(cdp, pw, { waitMs = 45_000 } = {}) {
  let present = false
  for (let i = 0; i < Math.ceil(waitMs / 1000); i += 1) {
    present = await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`).catch(() => false)
    if (present) break
    await sleep(1000)
  }
  if (!present) return { present: false }
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

/** 当前 client 是否真的挂了 crypto（debug state 会跨账号残留，不能只看它） */
async function cryptoBinding(cdp) {
  return cdp
    .evaluate(`
    (async () => {
      try {
        const m = await import('/src/services/matrix/index.ts');
        const c = m.matrixClientService.getClient?.();
        return { uid: c?.getUserId?.() ?? null, hasCrypto: Boolean(c?.getCrypto?.()) };
      } catch { return { uid: null, hasCrypto: false }; }
    })()
  `)
    .catch(() => ({ uid: null, hasCrypto: false }))
}

/**
 * 登出并 reload。
 *
 * ⚠️ 必须 reload：实测（2026-11-08）在同一页面里「登出 → 立刻登录新账号」会让
 * **client 仍指向旧账号、`getCrypto()` 为 null，但 debug state 报 initialized=true**
 * （debug state 无账号维度）⇒ device_keys 永不上传、E2EE 静默不可用（专项文档 D9）。
 * 中间插入一次 reload 后，新登录会创建唯一的 client，crypto 正常绑定。
 *
 * 另外：清 `localStorage.matrix` 并不足以切账号 —— token 在 Rust 侧，
 * reload 后 app 会照样恢复旧会话（实测），所以必须走真正的 logout。
 */
async function logoutAndReload(cdp) {
  await cdp.evaluate(`
    (async () => {
      const app = document.querySelector('#app')?.__vue_app__;
      const store = app?.config?.globalProperties?.$pinia?._s?.get?.('matrix');
      try { await store?.logout(); } catch {}
      return true;
    })()
  `)
  await sleep(5000)
  await cdp.evaluate(`location.reload(), true`).catch(() => {})
  await sleep(9000)
}


/** 等登录表单就绪（splashscreen 可能 10s+） */
async function waitLoginForm(cdp) {
  for (let i = 0; i < 40; i += 1) {
    const n = await cdp.evaluate('document.querySelectorAll("input").length').catch(() => 0)
    if (Number(n) >= 3) return true
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
  return false
}

async function login(cdp, username, password) {
  await waitLoginForm(cdp)
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
  for (let i = 0; i < 40; i += 1) {
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

/** 服务端视角：该用户是否已有 device_keys（= crypto 真的初始化并上报了） */
async function serverDeviceKeys(userId, token) {
  const q = await rest('POST', '/_matrix/client/v3/keys/query', { token, body: { device_keys: { [userId]: [] } } })
  const devices = q.body?.device_keys?.[userId] ?? {}
  const withKeys = Object.entries(devices).filter(([, d]) => d?.keys)
  return { total: Object.keys(devices).length, withKeys: withKeys.map(([id]) => id) }
}

/**
 * 等 crypto 就绪。
 *
 * 三种状态必须分开（这是上一轮误判的根源）：
 *   initialized=true                     → 就绪
 *   error !== null                       → 真失败
 *   attempted=true 且 error=null 且未初始化 → **initRustCrypto 还在飞**（挂起），不是失败
 * 挂起超过 STUCK_MS 就 reload 一次（清内存重来），最多重试一次。
 */
async function waitCryptoReady(cdp, { userId, token, label, username, password }) {
  const started = Date.now()
  let reloaded = false
  let lastState = null
  let lastLog = 0

  while (Date.now() - started < CRYPTO_TIMEOUT_MS) {
    const st = await cdp
      .evaluate(`
      (async () => {
        const m = await import('/src/services/matrix/index.ts');
        return m.matrixClientService.getRustCryptoDebugState?.() ?? null;
      })()
    `)
      .catch((e) => ({ error: String(e).slice(0, 120) }))
    lastState = st

    if (st?.initialized) {
      // debug state 会跨账号残留（见 D9），必须同时确认**当前 client 真的挂了 crypto**
      const bind = await cryptoBinding(cdp)
      if (!bind.hasCrypto) {
        return {
          ok: false,
          elapsedMs: Date.now() - started,
          state: st,
          reason: `debug state 报 initialized=true，但 getClient().getCrypto() 为 null（uid=${bind.uid}）—— 状态与绑定脱钩`
        }
      }
      // 本地 crypto 初始化完成 ≠ 服务端已看到 device_keys：上传发生在首次 sync 之后，
      // 实测可达 30s+（上一版在这里 20s 就判失败，误报成「没上报」）。
      const keys = await serverDeviceKeys(userId, token)
      const elapsed = Date.now() - started
      if (keys.withKeys.length) return { ok: true, elapsedMs: elapsed, state: st, keys, reloaded, bind }
      if (elapsed - lastLog > 15_000) {
        lastLog = elapsed
        console.log(`   · ${label} crypto 已本地就绪（client 已绑定），等服务端 device_keys ${(elapsed / 1000).toFixed(0)}s`)
      }
    }
    if (st?.error) {
      return { ok: false, elapsedMs: Date.now() - started, state: st, reason: `init 报错：${String(st.error).slice(0, 120)}` }
    }

    const elapsed = Date.now() - started
    if (elapsed - lastLog > 15_000) {
      lastLog = elapsed
      console.log(
        `   · ${label} crypto 等待中 ${(elapsed / 1000).toFixed(0)}s：attempted=${st?.attempted} initialized=${st?.initialized} error=${st?.error ?? 'null'}`
      )
    }

    // 挂起：把「还在飞」和「失败」分开处理
    if (!reloaded && st?.attempted && !st?.initialized && elapsed > CRYPTO_STUCK_MS) {
      console.log(`   · ${label} crypto 挂起 ${(elapsed / 1000).toFixed(0)}s（未 resolve），reload 一次重试`)
      await cdp.evaluate(`location.reload(), true`).catch(() => {})
      reloaded = true
      await sleep(12_000)
      await passUnlockDialog(cdp, UNLOCK_PW)
      await ensureLocalUnlock(cdp, UNLOCK_PW)
      // reload 后可能需要重新登录
      const bind = await cryptoBinding(cdp)
      if (!bind.uid) {
        const lg = await login(cdp, username ?? '', password ?? '')
        if (!lg.ok) console.log(`   · reload 后重新登录失败：${lg.reason}`)
      }
      continue
    }
    await sleep(3000)
  }
  return { ok: false, elapsedMs: Date.now() - started, state: lastState, reason: `${CRYPTO_TIMEOUT_MS / 1000}s 超时未就绪` }
}

async function gotoTargetRoom(cdp, roomId) {
  await cdp.evaluate(`
    (() => {
      const r = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
      r?.push({ name: 'mobileChatMain', params: { roomId: ${JSON.stringify(roomId)} } }).catch(() => {});
      return true;
    })()
  `)
  for (let i = 0; i < 25; i += 1) {
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

/** 轮询 timeline 直到出现目标文本或超时 */
async function waitTimelineText(cdp, roomId, needle, timeoutMs = 45_000) {
  const started = Date.now()
  let last = { count: 0, utd: 0, bodies: [] }
  while (Date.now() - started < timeoutMs) {
    last = await readTimeline(cdp, roomId)
    if (last.bodies.some((b) => b.includes(needle))) return { found: true, ...last, waitedMs: Date.now() - started }
    await sleep(2000)
  }
  return { found: false, ...last, waitedMs: Date.now() - started }
}

/**
 * 让一台设备的 app 就绪：force-stop → 启动 → CDP → 解锁 → （必要时登录）→ crypto 就绪。
 *
 * @returns {{ok:boolean, cdp?:object, action?:string, crypto?:object, reason?:string}}
 */
async function bringUp(device, account, { stage, restore = false } = {}) {
  const tag = device.key
  const t0 = Date.now()

  const rev = ensureReverse(device)
  const boot = await startAppWithCdp(device)
  if (!boot.ok) {
    record(stage, `${tag} 应用启动`, 'fail', boot.reason, boot)
    return { ok: false, reason: boot.reason }
  }
  record(stage, `${tag} 应用启动 + CDP 就绪`, 'pass', `pid=${boot.pid}，${((Date.now() - t0) / 1000).toFixed(0)}s，reverse=${rev}`)

  let cdp
  try {
    cdp = await openCdp(device.cdp)
  } catch (e) {
    record(stage, `${tag} CDP 连接`, 'fail', String(e).slice(0, 120))
    return { ok: false, reason: 'cdp' }
  }

  // 首屏：解锁弹窗 或 登录表单
  for (let i = 0; i < 45; i += 1) {
    const st = await cdp
      .evaluate(`
        (() => ({ n: document.querySelectorAll('input').length, unlock: document.body.innerText.includes('输入本地解锁密码'), href: location.href }))()
      `)
      .catch(() => null)
    if (st?.unlock || Number(st?.n) >= 3 || (st?.href ?? '').includes('/message')) break
    await sleep(1000)
  }

  const dialog = await passUnlockDialog(cdp, UNLOCK_PW)
  const unlock = await ensureLocalUnlock(cdp, UNLOCK_PW)
  record(
    stage,
    `${tag} 本地解锁（storageKey）`,
    Number(unlock?.keyLen) === 32 ? 'pass' : 'fail',
    `${unlock?.action ?? '?'}，keyLen=${unlock?.keyLen ?? 0}${dialog.present ? `，弹窗=${dialog.ok ? '已过' : '未过'}` : '，无弹窗'}`
  )

  // 凭证回退开关（必须在登录/持久化之前写；见文件头 D2 说明）
  const flag = await cdp
    .evaluate(`(() => { try { localStorage.setItem('tjg:session:web-fallback', '${WEB_FALLBACK ? '1' : '0'}'); return localStorage.getItem('tjg:session:web-fallback') } catch (e) { return 'error' } })()`)
    .catch(() => 'error')
  record(stage, `${tag} 凭证回退开关`, WEB_FALLBACK ? 'pass' : 'info', `tjg:session:web-fallback=${flag}${WEB_FALLBACK ? '' : '（关：用于复现 D2 会话不持久）'}`)

  // 会话：若已登录，先 logout + reload 变干净上下文，再登录目标账号
  //       （不能只清 localStorage：token 在 Rust 侧，reload 会照样恢复旧会话）
  const before = await cryptoBinding(cdp)
  if (restore && before.uid === account.userId) {
    // S3 这条本来就要验「冷启动能不能恢复会话」，登出反而把被测对象去掉
    record(stage, `${tag} 会话恢复（冷启动）`, 'pass', `已是 ${before.uid}`)
  } else {
    if (before.uid) {
      await logoutAndReload(cdp)
      await passUnlockDialog(cdp, UNLOCK_PW)
      await ensureLocalUnlock(cdp, UNLOCK_PW)
    }
    const afterLogout = await cryptoBinding(cdp)
    record(
      stage,
      `${tag} 清理旧会话`,
      afterLogout.uid ? 'fail' : 'pass',
      afterLogout.uid ? `仍登录着 ${afterLogout.uid}` : `已登出（原 ${before.uid ?? '未登录'}）`
    )
    // 回退开关在 reload 之后重写一次（reload 不会丢，但确保顺序在登录前）
    await cdp
      .evaluate(`(() => { try { localStorage.setItem('tjg:session:web-fallback', '${WEB_FALLBACK ? '1' : '0'}'); } catch {} return true })()`)
      .catch(() => null)

    const lg = await login(cdp, account.username, account.password)
    record(stage, `${tag} 登录`, lg.ok ? 'pass' : 'fail', lg.ok ? lg.href : lg.reason)
    if (!lg.ok) return { ok: false, cdp, reason: `login：${lg.reason}` }
  }

  // 登录后必须确认 client 是**目标账号**（历史上出现过 client 仍指向旧账号）
  const bind = await cryptoBinding(cdp)
  record(
    stage,
    `${tag} client 归属校验`,
    bind.uid === account.userId ? 'pass' : 'fail',
    `uid=${bind.uid}${bind.uid === account.userId ? '' : `（期望 ${account.userId}）`}`
  )
  if (bind.uid !== account.userId) return { ok: false, cdp, reason: `client uid=${bind.uid}，期望 ${account.userId}` }
  const action = before.uid ? (restore ? 'restored' : 'logout+reload+login') : 'login'

  const crypto = await waitCryptoReady(cdp, { userId: account.userId, token: account.token, label: tag, username: account.username, password: account.password })
  record(
    stage,
    `${tag} crypto 就绪（device_keys 上报）`,
    crypto.ok ? 'pass' : 'fail',
    crypto.ok
      ? `${(crypto.elapsedMs / 1000).toFixed(1)}s，device=${crypto.keys.withKeys.join(',')}${crypto.reloaded ? '（reload 重试后成功）' : ''}`
      : `${(crypto.elapsedMs / 1000).toFixed(0)}s：${crypto.reason ?? '未就绪'}｜state=${JSON.stringify(crypto.state)}`,
    crypto
  )
  return { ok: crypto.ok, cdp, action, crypto, reason: crypto.ok ? null : (crypto.reason ?? 'crypto 未就绪'), startedMs: Date.now() - t0 }
}

async function main() {
  const started = Date.now()
  const ctx = {}
  let cdpA = null
  let cdpB = null
  let roomId = null

  try {
    phase(`S0 准备（串行=${SERIAL ? '开' : '关'}）`)
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
        initial_state: [
          { type: 'm.room.encryption', state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }
        ]
      }
    })
    if (created.status !== 200) throw new Error(`createRoom ${created.status}`)
    roomId = created.body.room_id
    ctx.roomId = roomId
    await rest('POST', `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, { token: b.token, body: {} })
    record('S0', '账号与加密房', 'pass', `${roomId}（A=${a.username} B=${b.username}）`)

    // ── S1：仅 A 在线
    phase('S1 仅 A 在线（B 强制停止）')
    if (SERIAL) {
      const stopB = forceStopApp(DEVICES.b)
      record('S1', 'B 已强制停止（让出 CPU/内存给 A 的 crypto 初始化）', stopB.ok ? 'pass' : 'fail', `pid=${stopB.pid ?? 'null'}`)
    }
    const upA1 = await bringUp(DEVICES.a, a, { stage: 'S1' })
    cdpA = upA1.cdp ?? null
    if (!upA1.ok) throw new Error(`A 未就绪：${upA1.reason}`)

    const navA = await gotoTargetRoom(cdpA, roomId)
    record('S1', 'A 进入加密房', navA.ok ? 'pass' : 'fail', navA.ok ? `${navA.waitedMs}ms` : '找不到输入框')
    const textA1 = `A1-${Date.now()}`
    const sendA1 = await realSend(cdpA, textA1)
    record('S1', 'A 真实点击发送（msgA1）', sendA1.ok ? 'pass' : 'fail', sendA1.ok ? `输入框已清空=${sendA1.composerCleared}` : sendA1.reason)
    await sleep(3000)
    const msgs1 = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, { token: a.token })
    const enc1 = (msgs1.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
    const plain1 = (msgs1.body?.chunk ?? []).filter((e) => e.type === 'm.room.message')
    record('S1', '服务端形态（msgA1）', enc1.length ? 'pass' : 'fail', `encrypted=${enc1.length} / plaintext=${plain1.length}`)
    ctx.textA1 = textA1
    cdpA.close()
    cdpA = null

    // ── S2：仅 B 在线
    phase('S2 仅 B 在线（A 强制停止）')
    if (SERIAL) {
      const stopA = forceStopApp(DEVICES.a)
      record('S2', 'A 已强制停止', stopA.ok ? 'pass' : 'fail', `pid=${stopA.pid ?? 'null'}`)
    }
    const upB = await bringUp(DEVICES.b, b, { stage: 'S2' })
    cdpB = upB.cdp ?? null
    if (!upB.ok) throw new Error(`B 未就绪：${upB.reason}`)

    const navB = await gotoTargetRoom(cdpB, roomId)
    record('S2', 'B 进入加密房', navB.ok ? 'pass' : 'fail', navB.ok ? `${navB.waitedMs}ms` : '找不到输入框')
    const tlB0 = await waitTimelineText(cdpB, roomId, textA1, 20_000)
    record(
      'S2',
      'B 对 msgA1 的处置（预期 UTD：A 发送时 B 尚无 device_keys）',
      tlB0.found ? 'pass' : tlB0.utd > 0 ? 'pass' : 'info',
      tlB0.found
        ? `意外解密成功（A 发送时已含 B 的密钥）`
        : `timeline=${tlB0.count} 条，UTD=${tlB0.utd}（新设备无历史密钥，见 D5）`
    )
    const textB1 = `B1-${Date.now()}`
    const sendB1 = await realSend(cdpB, textB1)
    record('S2', 'B 真实点击发送（msgB1，A 离线）', sendB1.ok ? 'pass' : 'fail', sendB1.ok ? `输入框已清空=${sendB1.composerCleared}` : sendB1.reason)
    ctx.textB1 = textB1
    await sleep(4000)
    const msgs2 = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=30`, { token: a.token })
    const enc2 = (msgs2.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
    record('S2', '服务端已累计 2 条 m.room.encrypted', enc2.length >= 2 ? 'pass' : 'fail', `${enc2.length} 条`)

    // ── S3：A 冷启动回来 → 双向解密
    phase('S3 A 冷启动回到在线 → 双向解密')
    const upA2 = await bringUp(DEVICES.a, a, { stage: 'S3', restore: true })
    cdpA = upA2.cdp ?? null
    if (!cdpA) throw new Error('A 第二次启动失败')

    const navA2 = await gotoTargetRoom(cdpA, roomId)
    record('S3', 'A 进入加密房', navA2.ok ? 'pass' : 'fail', navA2.ok ? `${navA2.waitedMs}ms` : '找不到输入框')
    const tlA = await waitTimelineText(cdpA, roomId, textB1, 60_000)
    record(
      'S3',
      'A 解密显示 B 的消息（B → A）',
      tlA.found ? 'pass' : tlA.utd > 0 ? 'fail' : 'fail',
      tlA.found ? `timeline 含 ${textB1}（${(tlA.waitedMs / 1000).toFixed(1)}s）` : `timeline=${tlA.count} 条，UTD=${tlA.utd}`,
      { utd: tlA.utd }
    )

    const textA2 = `A2-${Date.now()}`
    const sendA2 = await realSend(cdpA, textA2)
    record('S3', 'A 真实点击发送（msgA2，此时 B 的 device_keys 已上传）', sendA2.ok ? 'pass' : 'fail', sendA2.ok ? `输入框已清空=${sendA2.composerCleared}` : sendA2.reason)
    ctx.textA2 = textA2
    await sleep(4000)

    const tlB1 = await waitTimelineText(cdpB, roomId, textA2, 60_000)
    record(
      'S3',
      'B 解密显示 A 的新消息（A → B）',
      tlB1.found ? 'pass' : 'fail',
      tlB1.found ? `timeline 含 ${textA2}（${(tlB1.waitedMs / 1000).toFixed(1)}s）` : `timeline=${tlB1.count} 条，UTD=${tlB1.utd}`,
      { utd: tlB1.utd }
    )

    const msgs3 = await rest('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`, { token: a.token })
    const enc3 = (msgs3.body?.chunk ?? []).filter((e) => e.type === 'm.room.encrypted')
    const plain3 = (msgs3.body?.chunk ?? []).filter((e) => e.type === 'm.room.message')
    record('S3', '服务端最终形态', enc3.length >= 3 && plain3.length === 0 ? 'pass' : 'fail', `encrypted=${enc3.length} / plaintext=${plain3.length}`)
  } catch (error) {
    record('XX', '流程中断', 'fail', error instanceof Error ? error.message : String(error))
  } finally {
    cdpA?.close?.()
    cdpB?.close?.()
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
  console.log(
    `\n== 汇总：${summary.pass} passed / ${summary.fail} failed / ${summary.info} info / ${summary.skip} skip，${(summary.durationMs / 1000).toFixed(1)}s ==`
  )
  if (roomId) console.log(`房间 ${roomId}；账号 ${ctx.a?.username} / ${ctx.b?.username}（密码 ${PASSWORD}）`)
  process.exitCode = summary.fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('脚本异常:', e.message)
  process.exitCode = 2
})
