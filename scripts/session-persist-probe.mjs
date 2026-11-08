#!/usr/bin/env node
/**
 * 探针：Android 端「登录态能否跨冷启动保持」。
 *
 * 背景（2026-11-08 实测）：`src-tauri/src/utils/secure_store.rs` 的
 *   - keychain 分支：`set_password` 返回 Ok，但 `get_password` 拿不到
 *     （日志写成 `macOS dev mode ACL issue`，Android 上同样命中）；
 *   - 文件 fallback：目录只按 `$HOME` 推导，而 Android 进程没有 `HOME`
 *     ⇒ `Cannot determine fallback path` ⇒ `Both keychain and fallback failed`。
 * 结果是 access token 一条都存不下，冷启动必然回到登录页。
 *
 * 本探针把这条判据固化成可复跑检查：
 *   登录 → 确认已登录 → force-stop → 重新启动 → 等 45s → 看 userId 是否还在。
 *
 * 判据（不依赖任何内部实现细节）：
 *   - `userId` 恢复 ⇒ pass
 *   - 回到登录页 / userId 为 null ⇒ fail（D2 未修）
 *
 * 用法：
 *   node scripts/session-persist-probe.mjs [cdpPort] [serial]
 *   默认 CDP 9222 / serial emulator-5554
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PORT = Number(process.argv[2] ?? 9222)
const SERIAL = process.argv[3] ?? 'emulator-5554'
const BASE = (process.env.E2EE_BASE ?? 'http://127.0.0.1:8008').replace(/\/$/, '')
const PASSWORD = process.env.E2EE_PASSWORD ?? 'E2ee!probe9x8y7z'
const UNLOCK_PW = process.env.E2EE_UNLOCK_PW ?? 'DevUnlock!2026'
const ANDROID_HOME = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`
const ADB =
  [process.env.ADB, `${ANDROID_HOME}/platform-tools/adb`, '/opt/homebrew/bin/adb', 'adb'].find(
    (p) => p && (p === 'adb' || existsSync(p))
  ) ?? 'adb'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const adb = (args) => {
  try {
    return execFileSync(ADB, ['-s', SERIAL, ...args], { encoding: 'utf8', timeout: 30000 }).trim()
  } catch (e) {
    return `ERR ${String(e.message ?? e).slice(0, 100)}`
  }
}

async function openCdp(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('没有 WebView target')
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
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result?.value
  }
  return { evaluate, close: () => ws.close() }
}

async function rest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  return { status: res.status, body: await res.json().catch(() => null) }
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

async function passUnlock(cdp) {
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
    (() => {
      const b = [...document.querySelectorAll('button, .van-dialog__confirm, [role="button"]')].find((x) => /^解锁$/.test((x.innerText || '').trim()));
      b?.click();
      return true;
    })()
  `)
  await sleep(3000)
  return true
}

async function ensureUnlocked(cdp) {
  await passUnlock(cdp)
  await cdp.evaluate(`
    (async () => {
      const m = await import('/src/services/secure/localUnlockKey.ts');
      if (!m.isLocalUnlockConfigured()) await m.configureLocalUnlock(${JSON.stringify(UNLOCK_PW)});
      else if (!m.isLocalUnlockUnlocked()) await m.unlockLocalUnlock(${JSON.stringify(UNLOCK_PW)});
      return true;
    })()
  `)
}

async function login(cdp, username) {
  // 冷启动的解锁弹窗会盖在登录页上（此时 DOM 里只有 1 个 input），
  // 不先过掉它，后面的「等 3 个 input」会一直等到超时。
  for (let i = 0; i < 30; i += 1) {
    const unlockNow = await cdp.evaluate(`document.body.innerText.includes('输入本地解锁密码')`).catch(() => false)
    if (unlockNow) await passUnlock(cdp)
    const n = await cdp.evaluate('document.querySelectorAll("input").length').catch(() => 0)
    if (!unlockNow && Number(n) >= 3) break
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
      if (!account || !pwd) return { ok: false };
      if (server) s(server, ${JSON.stringify(BASE)});
      s(account, ${JSON.stringify(username)});
      s(pwd, ${JSON.stringify(PASSWORD)});
      return { ok: true };
    })()
  `)
  if (!filled?.ok) return { ok: false, reason: '填表失败' }
  await sleep(500)
  await cdp.evaluate(`
    (() => {
      const b = [...document.querySelectorAll('button, .van-button')].find((x) => (x.innerText || '').trim() === '登录');
      b?.click();
      return true;
    })()
  `)
  for (let i = 0; i < 45; i += 1) {
    await sleep(1000)
    if (await uidOf(cdp)) return { ok: true }
  }
  return { ok: false, reason: '登录后仍无 client' }
}

async function main() {
  const username = `persist${Date.now().toString(36)}`
  const reg = await rest('POST', '/_matrix/client/v3/register', {
    username,
    password: PASSWORD,
    auth: { type: 'm.login.dummy' }
  })
  if (reg.status !== 200) throw new Error(`register ${reg.status}`)
  const userId = reg.body.user_id
  console.log(`账号 ${username} / ${userId}`)

  // 清掉回退开关：这一轮要验的就是「不开回退时能否持久」
  adb(['reverse', 'tcp:5210', 'tcp:5210'])
  adb(['reverse', 'tcp:8008', 'tcp:8008'])
  adb(['forward', '--remove', `tcp:${PORT}`])
  adb(['shell', 'am', 'force-stop', 'com.tjg.app'])
  await sleep(1500)
  const pid = adb(['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])
  console.log(`启动：${pid.split('\n')[0]}`)
  let p = null
  for (let i = 0; i < 40; i += 1) {
    const out = adb(['shell', 'pidof', 'com.tjg.app'])
    if (/^\d+/.test(out)) {
      p = out.split(/\s+/)[0]
      break
    }
    await sleep(1000)
  }
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${p}`])
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      if (list.some((t) => t.type === 'page')) break
    } catch {
      /* wait */
    }
    await sleep(1000)
  }

  const cdp = await openCdp(PORT)
  await ensureUnlocked(cdp)
  await cdp.evaluate(`localStorage.removeItem('tjg:session:web-fallback'), true`)
  const tokenBefore = await cdp.evaluate(`localStorage.getItem('tjg.matrix.accessToken')`)

  // 上一次遗留的登录先登出，保证走真实登录
  const pre = await uidOf(cdp)
  if (pre) {
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
  }
  const lg = await login(cdp, username)
  const afterLogin = await uidOf(cdp)
  const tokenAfter = await cdp.evaluate(`localStorage.getItem('tjg.matrix.accessToken')`)
  console.log(`登录：${lg.ok ? 'ok' : lg.reason}，client userId=${afterLogin}`)
  console.log(`localStorage token：登录前=${tokenBefore ? '有' : '无'} / 登录后=${tokenAfter ? '有' : '无'}`)
  cdp.close()

  // 冷启动
  adb(['shell', 'am', 'force-stop', 'com.tjg.app'])
  await sleep(2000)
  adb(['shell', 'am', 'start', '-n', 'com.tjg.app/com.tjg.app.MainActivity'])
  await sleep(8000)
  let p2 = null
  for (let i = 0; i < 30; i += 1) {
    const out = adb(['shell', 'pidof', 'com.tjg.app'])
    if (/^\d+/.test(out)) {
      p2 = out.split(/\s+/)[0]
      break
    }
    await sleep(1000)
  }
  adb(['forward', '--remove', `tcp:${PORT}`])
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${p2}`])
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      if (list.some((t) => t.type === 'page')) break
    } catch {
      /* wait */
    }
    await sleep(1000)
  }

  const cdp2 = await openCdp(PORT)
  await ensureUnlocked(cdp2)
  let restored = null
  for (let i = 0; i < 45; i += 1) {
    restored = await uidOf(cdp2)
    if (restored) break
    await sleep(1000)
  }
  const href = await cdp2.evaluate('location.href')
  const stored = await cdp2.evaluate(`
    (() => {
      const raw = localStorage.getItem('matrix');
      let parsed = null;
      try { parsed = JSON.parse(raw ?? '{}') } catch {}
      return { persistedUserId: parsed?.userId ?? null, hasToken: Boolean(localStorage.getItem('tjg.matrix.accessToken')) };
    })()
  `)
  cdp2.close()

  console.log(`\n冷启动后：userId=${restored}，路由=${String(href).replace('http://tauri.localhost', '')}`)
  console.log(`localStorage：persistedUserId=${stored.persistedUserId}，hasToken=${stored.hasToken}`)
  if (restored) {
    console.log('\n✅ 会话跨冷启动已恢复（D2 已修）')
  } else {
    console.log('\n❌ 冷启动后没有 client（回到登录页 / 空页面）')
    console.log('   ⇒ D2：Android 侧 secure_store 两条路都不可用（keychain get 失败 + fallback 只认 $HOME）')
    console.log('   ⇒ 证据：adb logcat | grep secure_store → "Both keychain and fallback failed"')
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error('探针异常:', e.message)
  process.exitCode = 2
})
