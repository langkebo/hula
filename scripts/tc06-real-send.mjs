#!/usr/bin/env node
/**
 * TC-06：真机「真实点击发送按钮」→ 服务端出现 m.room.encrypted。
 *
 * 为什么单独一支：`MsgInputMobileControls.vue` 里的发送按钮是
 *   `<n-button v-if="hasInput" type="primary">{{ t('editor.send') }}</n-button>`
 * 即「按钮只在输入框有内容时渲染、文案是 i18n 的 `editor.send`（zh-CN = 发送）」。
 * 而 Enter 走的是 `@keydown.exact.enter="handleEnterKey"`，实测在移动端输入框里
 * 只产生换行（合成的 KeyboardEvent 不被识别；CDP 真实按键也一样）。
 * 所以「UI 能不能发出去」只能靠**真实点击那个按钮**来判定。
 *
 * 三条判据（必须同时成立，缺一不可）：
 *   1) 输入框被清空（组件认为已提交）
 *   2) SDK timeline 里出现该文本的事件
 *   3) 服务端该房间出现新的 m.room.encrypted（用 DB 查，不依赖前端状态）
 *
 * 用法：
 *   node scripts/tc06-real-send.mjs                 # 用当前页面的房间
 *   node scripts/tc06-real-send.mjs '!roomid:server'
 */

const CDP = `http://127.0.0.1:${process.env.CDP_PORT ?? 9222}`
const JSON_ONLY = process.env.TC06_JSON === '1'
const results = []
const record = (name, level, detail, evidence) => {
  results.push({ name, level, detail, evidence: evidence ?? null })
  if (!JSON_ONLY) {
    const tag = { pass: '✅', fail: '❌', skip: '⏭️ ', info: 'ℹ️ ' }[level] ?? '·'
    console.log(`${tag} ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const log = (...a) => {
  if (!JSON_ONLY) console.log(...a)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ── 最小 CDP 客户端（需要 Input 域，cdp-eval 只包了 Runtime）───────────── */
async function connect() {
  const list = await (await fetch(`${CDP}/json/list`)).json()
  const page = list.find((t) => t.type === 'page' && t.url.includes('tauri.localhost'))
  if (!page) throw new Error('没有 tauri WebView target（CDP 转发失效或 app 未起）')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
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
  return { ws, send, evaluate, url: page.url }
}

/** 真实鼠标左键单击（按下 + 抬起，带按下/抬起间隔，更接近人手） */
async function realClick(send, x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 })
  await sleep(60)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await sleep(80)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

/** 查服务端最近 3 分钟内该房间的 encrypted 事件（不经前端，最硬判据） */
async function serverEvents(roomId) {
  const { execFileSync } = await import('node:child_process')
  const sql = `select count(*) from events where room_id='${roomId.replace(/'/g, "''")}' and event_type='m.room.encrypted' and origin_server_ts > (extract(epoch from now())*1000 - 180000)`
  const out = execFileSync('docker', ['exec', 'synapse-postgres', 'psql', '-U', 'synapse', '-d', 'synapse', '-tAc', sql], {
    encoding: 'utf8',
    timeout: 15000
  })
  return Number(out.trim())
}

async function main() {
  const started = Date.now()
  const { ws, send, evaluate, url } = await connect()
  const roomId = process.argv[2] ?? (url.match(/chatMain\/(.+)$/)?.[1] ?? null)
  log(`\n== TC-06 真实点击发送  room=${roomId ?? '(当前页面)'} ==\n`)
  if (!roomId) throw new Error('拿不到 roomId：请先导航到某个房间，或用参数传入')

  // 0) 清空输入框（避免上一轮残留干扰「清空」判据）
  await evaluate(`
    (() => {
      const el = document.querySelector('#message-input');
      if (!el) return false;
      el.focus();
      const sel = window.getSelection(); const range = document.createRange();
      range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('delete');
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return true;
    })()
  `)
  await sleep(500)

  const before = await serverEvents(roomId)
  record('服务端基线（近 3 分钟 encrypted 条数）', 'info', String(before))

  // 1) 真实输入（Input.insertText → 触发 input 事件 → msgInput 更新 → hasInput 非空）
  const text = `tc06-${Date.now()}`
  await evaluate(`document.querySelector('#message-input')?.focus()`)
  await sleep(200)
  await send('Input.insertText', { text })
  await sleep(900)
  const typed = await evaluate(`(document.querySelector('#message-input')?.innerText ?? '').trim()`)
  record('输入文本进入编辑器', typed.includes(text) ? 'pass' : 'fail', JSON.stringify(typed.slice(0, 40)))

  // 2) 发送按钮是否出现（hasInput 生效）
  const btn = await evaluate(`
    (() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((x) => (x.innerText || '').trim() === '发送' || (x.innerText || '').trim() === 'Send');
      if (!b) return { found: false, candidates: btns.map((x) => (x.innerText || '').trim()).filter(Boolean).slice(0, 8) };
      const r = b.getBoundingClientRect();
      return {
        found: true,
        x: Math.round(r.left + r.width / 2),
        y: Math.round(r.top + r.height / 2),
        disabled: b.disabled || b.className.includes('disabled'),
        w: Math.round(r.width), h: Math.round(r.height)
      };
    })()
  `)
  record(
    '发送按钮出现且可点',
    btn?.found && !btn.disabled ? 'pass' : 'fail',
    btn?.found ? `rect ${btn.w}×${btn.h} @ (${btn.x},${btn.y}) disabled=${btn.disabled}` : `未找到，候选按钮：${JSON.stringify(btn?.candidates ?? [])}`,
    btn
  )
  if (!btn?.found || btn?.disabled) {
    record('真实点击发送', 'skip', '按钮不可用，后续判据无法成立')
    ws.close()
    return finish(started, roomId)
  }

  // 3) 真实鼠标点击
  const timelineBefore = await evaluate(`
    (async () => {
      const m = await import('/src/services/matrix/index.ts');
      const room = m.matrixClientService.getClient()?.getRoom(${JSON.stringify(roomId)});
      return (room?.getLiveTimeline?.()?.getEvents?.() ?? []).length;
    })()
  `)
  await realClick(send, btn.x, btn.y)
  record('真实鼠标点击发送按钮', 'pass', `(${btn.x},${btn.y})`)
  await sleep(7000)

  // 4) 三判据
  const after = await evaluate(`
    (async () => {
      const m = await import('/src/services/matrix/index.ts');
      const room = m.matrixClientService.getClient()?.getRoom(${JSON.stringify(roomId)});
      const evs = (room?.getLiveTimeline?.()?.getEvents?.() ?? []).map((e) => ({
        t: e.getType?.(), status: e.status, body: String(e.getContent?.()?.body ?? '').slice(0, 40)
      }));
      const el = document.querySelector('#message-input');
      return {
        composer: (el?.innerText ?? '').trim().slice(0, 40),
        eventCount: evs.length,
        hasText: evs.some((e) => e.body.includes(${JSON.stringify(text)})),
        last3: evs.slice(-3)
      };
    })()
  `)
  const composerCleared = !String(after?.composer ?? '').includes(text)
  record('① 输入框已清空', composerCleared ? 'pass' : 'fail', JSON.stringify(after?.composer ?? ''), { before: typed.slice(0, 40) })

  record(
    '② timeline 出现该消息',
    after?.hasText || after?.eventCount > Number(timelineBefore) ? 'pass' : 'fail',
    `事件数 ${timelineBefore} → ${after?.eventCount}，含文本=${after?.hasText}`,
    after?.last3
  )

  const serverAfter = await serverEvents(roomId)
  record('③ 服务端出现新的 m.room.encrypted', serverAfter > before ? 'pass' : 'fail', `${before} → ${serverAfter} 条（近 3 分钟）`)

  ws.close()
  finish(started, roomId)
}

function finish(started, roomId) {
  const summary = {
    roomId,
    durationMs: Date.now() - started,
    pass: results.filter((r) => r.level === 'pass').length,
    fail: results.filter((r) => r.level === 'fail').length,
    skip: results.filter((r) => r.level === 'skip').length,
    results
  }
  if (JSON_ONLY) console.log(JSON.stringify(summary, null, 2))
  else log(`\n== 汇总：${summary.pass} passed / ${summary.fail} failed / ${summary.skip} skipped，${(summary.durationMs / 1000).toFixed(1)}s ==`)
  process.exitCode = summary.fail === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('TC-06 脚本异常:', e.message)
  process.exitCode = 2
})
