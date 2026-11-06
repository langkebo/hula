#!/usr/bin/env node
/**
 * 通过 CDP 在**真机/模拟器 WebView**里执行 JS 的最小工具。
 *
 * 背景：Tauri Android 的 WebView 在 debug 构建下开了 `webview_devtools_remote_<pid>`，
 * `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` 之后就能像 Chrome
 * 一样驱动它 —— 这样「移动端真机」不需要 Appium/uiautomator（后者对 Tauri WebView
 * 取不到任何节点，`uiautomator dump` 实测 0 个带文本节点）。
 *
 * 用法：
 *   node scripts/cdp-eval.mjs "document.title"
 *   node scripts/cdp-eval.mjs --file /tmp/probe.js
 *   CDP_PORT=9222 node scripts/cdp-eval.mjs --list
 */

const PORT = Number(process.env.CDP_PORT ?? 9222)
const HOST = process.env.CDP_HOST ?? '127.0.0.1'

async function targets() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`)
  return res.json()
}

async function pickTarget() {
  const list = await targets()
  const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  if (!pages.length) throw new Error('没有可用的 page target（WebView 调试没开？）')
  // 优先 tauri 页面
  return pages.find((t) => t.url.includes('tauri.localhost')) ?? pages[0]
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    } else if (msg.method) {
      events.push(msg)
    }
  })
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', () => reject(new Error('CDP 连接失败')))
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { ws, ready, send, events }
}

async function evaluate(send, expression, { awaitPromise = true } = {}) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  })
  if (res.exceptionDetails) {
    return { error: res.exceptionDetails.exception?.description ?? res.exceptionDetails.text }
  }
  return { value: res.result?.value }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--list')) {
    const list = await targets()
    for (const t of list) console.log(`${t.type}\t${t.title}\t${t.url}`)
    return
  }
  const fileIdx = argv.indexOf('--file')
  const expression = fileIdx >= 0 ? (await import('node:fs')).readFileSync(argv[fileIdx + 1], 'utf8') : argv[0]
  if (!expression) {
    console.error('用法: node scripts/cdp-eval.mjs "<js>" | --file <path> | --list')
    process.exitCode = 2
    return
  }
  const target = await pickTarget()
  const { ws, ready, send } = connect(target.webSocketDebuggerUrl)
  await ready
  await send('Runtime.enable')
  const out = await evaluate(send, expression)
  console.log(JSON.stringify({ url: target.url, ...out }, null, 2))
  ws.close()
  if (out.error) process.exitCode = 1
}

main().catch((e) => {
  console.error(e.message)
  process.exitCode = 2
})
