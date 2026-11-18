/**
 * 单条消息 → 独立 HTML 文件的构造器（纯函数，无 IO）。
 *
 * ## 为什么是前端本地生成
 *
 * `POST /rooms/{id}/convert/{event_id}` 曾被期望用于「导出 HTML」，但实测后端
 * （`synapse-web/src/routes/handlers/room/events.rs:1096-1117`）只做**事件视图投影**
 * ——返回 `{ converted: { type, content, sender, origin_server_ts } }`，端点 `body: none`/`query: none`，
 * 既不做格式转换、也不接受输出格式。SDK 的 `RoomConvertResult`（`output_format`/`provider`…）
 * 与该实现不一致，按其实现会静默拿到 `undefined`。
 *
 * 因此导出改为**客户端生成**：只依赖消息本身，不访问网络、不依赖服务端转换器，
 * 也就没有「服务端没装 pandoc 就导不出」这类环境依赖。
 *
 * ## 安全约束
 *
 * 消息正文是**不可信输入**（可能是对方发来的任意文本）。写入 HTML 前必须全量转义，
 * 否则导出的文件会成为 XSS 载体（用户在浏览器里打开后执行脚本）。
 */

export interface MessageHtmlExportInput {
  /** 发件人展示名（缺失时退化为 MXID） */
  sender: string
  /** 发送时间戳（毫秒） */
  timestamp: number | null | undefined
  /** 纯文本正文 */
  content: string
  /** 房间名，用于 `<title>`；可缺省 */
  roomName?: string | undefined
  /** 客户端展示名，写入页脚 */
  appName?: string | undefined
}

/** HTML 转义：文本节点与属性值共用 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 把毫秒时间戳格式化为 `YYYY-MM-DD HH:mm:ss`（本地时区；无效时间返回空串） */
export function formatExportTime(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) return ''
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

/**
 * 构造完整的 HTML 文档。
 *
 * 换行按原样保留（`white-space: pre-wrap`），避免把多段消息压成一行；
 * 不引入任何外部资源（字体/CDN），保证离线可打开。
 */
export function buildMessageHtml(input: MessageHtmlExportInput): string {
  const sender = escapeHtml(input.sender || '')
  const content = escapeHtml(input.content || '')
  const time = formatExportTime(input.timestamp)
  const titleBase = input.roomName ? `${input.roomName} · ${input.sender}` : input.sender
  const title = escapeHtml(titleBase)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { margin: 24px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; color: #1f2328; }
  .meta { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #d0d7de; font-size: 13px; color: #57606a; }
  .meta div + div { margin-top: 4px; }
  .content { white-space: pre-wrap; word-break: break-word; font-size: 15px; }
  footer { margin-top: 24px; font-size: 12px; color: #8b949e; }
</style>
</head>
<body>
  <section class="meta">
    <div>发件人：${sender}</div>
    ${time ? `<div>时间：${escapeHtml(time)}</div>` : ''}
    ${input.roomName ? `<div>房间：${escapeHtml(input.roomName)}</div>` : ''}
  </section>
  <article class="content">${content}</article>
  <footer>${escapeHtml(input.appName || 'Tjg')}</footer>
</body>
</html>
`
}

/** 建议文件名：`消息-<时间戳或 id 片段>.html`，去掉路径分隔符与控制字符 */
export function buildExportFileName(eventId: string, timestamp?: number | null): string {
  const stamp = formatExportTime(timestamp).replace(/[-: ]/g, '') || eventId.replace(/[^\w-]/g, '').slice(-12)
  return `消息-${stamp || 'export'}.html`
}
