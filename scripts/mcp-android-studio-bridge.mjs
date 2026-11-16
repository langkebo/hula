#!/usr/bin/env node
/**
 * stdio ↔ SSE 桥：把 MCP 客户端的 stdio 会话接到 JetBrains MCP Server 插件的**经典 SSE** 传输上。
 *
 * ## 为什么需要它
 *
 * Android Studio 的 `MCP Server` 插件（262.10968.92）只暴露经典 SSE：
 *   - `GET  http://127.0.0.1:<built-in+1000>/sse`      → `event: endpoint` + `data: /message?sessionId=…`
 *   - `POST http://127.0.0.1:<同上>/message?sessionId=…` → 405（只收 POST）
 * 而 npm 上的 `@jetbrains/mcp-proxy@1.8.0` 只讲新版 **Streamable HTTP**（`${endpoint}/mcp/list_tools`），
 * 会在这个插件上稳定 404。两者对不上，所以用这个零依赖桥接（只用 node 内置 fetch / streams）。
 *
 * ## 用法
 *
 *   node scripts/mcp-android-studio-bridge.mjs http://127.0.0.1:64342/sse
 *
 * 端口 = IDE 内置服务器端口 + 1000（内置默认 63342 ⇒ MCP 64342）。
 * 不确定时先 `lsof -nP -iTCP:64342 -sTCP:LISTEN`，或看
 * `~/Library/Caches/Google/AndroidStudio2026.2.2/.pid` 对应进程的监听端口。
 *
 * ## 约定
 *
 * - stdout **只**输出 JSON-RPC（一行一条），所有诊断信息走 stderr；
 * - 会话地址由 SSE 的 `endpoint` 事件给出，收到前的请求先入队；
 * - stdin 关闭后等 4s 再退出，避免「客户端一次性灌完就关管道」时丢响应。
 */

const SSE_URL = process.argv[2] ?? 'http://127.0.0.1:64342/sse'
const EXIT_GRACE_MS = 4000

let sessionPostUrl = null
const pending = []

const log = (msg) => process.stderr.write(`[mcp-bridge] ${msg}\n`)

/** 把一条 JSON-RPC 消息回给客户端（stdio 用换行分隔） */
const emit = (message) => process.stdout.write(`${JSON.stringify(message)}\n`)

/** 转发到插件的 `/message?sessionId=…`；会话还没建立时先排队 */
const forward = async (message) => {
  if (!sessionPostUrl) {
    pending.push(message)
    return
  }
  try {
    const response = await fetch(sessionPostUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    if (!response.ok) log(`转发失败 ${response.status}：${String(message).slice(0, 120)}`)
  } catch (error) {
    log(`转发异常：${String(error)}`)
  }
}

/** 解析 SSE 帧：`event: xxx` + `data: yyy`（data 可多行） */
const handleFrame = (frame) => {
  const lines = frame.split('\n')
  let event = 'message'
  const data = []
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  const payload = data.join('\n')

  if (event === 'endpoint') {
    // 插件给的是相对路径（/message?sessionId=…），按 SSE 地址补成绝对地址
    const base = new URL(SSE_URL)
    sessionPostUrl = new URL(payload, `${base.protocol}//${base.host}`).toString()
    log(`会话已建立：${sessionPostUrl}`)
    for (const message of pending.splice(0)) void forward(message)
    return
  }

  if (event === 'message' && payload) {
    try {
      emit(JSON.parse(payload))
    } catch {
      log(`无法解析的 SSE 消息：${payload.slice(0, 120)}`)
    }
  }
}

const openStream = async () => {
  const response = await fetch(SSE_URL, { headers: { Accept: 'text/event-stream' } })
  if (!response.ok || !response.body) throw new Error(`SSE 连接失败：${response.status}`)
  log(`已连接 ${SSE_URL}`)

  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of response.body) {
    // 插件用 CRLF 分帧（`: heartbeat\r\n\r\nevent: endpoint\r\n…`），先归一成 LF 再按空行切帧
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n')
    let index = buffer.indexOf('\n\n')
    while (index !== -1) {
      const frame = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      if (frame.trim() && !frame.startsWith(':')) handleFrame(frame)
      index = buffer.indexOf('\n\n')
    }
  }
}

/** stdin：一行一条 JSON-RPC */
const readStdin = () => {
  let buffer = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index !== -1) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) {
        try {
          void forward(JSON.parse(line))
        } catch {
          log(`客户端发来非法 JSON：${line.slice(0, 120)}`)
        }
      }
      index = buffer.indexOf('\n')
    }
  })
  process.stdin.on('end', () => {
    log(`stdin 关闭，${EXIT_GRACE_MS}ms 后退出`)
    setTimeout(() => process.exit(0), EXIT_GRACE_MS)
  })
}

try {
  readStdin()
  await openStream()
  log('SSE 流已结束')
} catch (error) {
  log(`致命错误：${String(error)}`)
  process.exit(1)
}
