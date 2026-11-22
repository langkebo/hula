/**
 * 从 SDK 抛出的错误中提取 Matrix errcode。
 *
 * 部分错误（HTTP 封装层）把 errcode 塞在 `message` 的 JSON 串里，
 * 因此按 errcode → code → message 内嵌 JSON 的顺序读取。
 */
export function readErrcode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const record = err as { errcode?: unknown; code?: unknown; message?: unknown }
  if (typeof record.errcode === 'string') return record.errcode
  if (typeof record.code === 'string') return record.code
  if (typeof record.message === 'string') {
    const jsonMatch = record.message.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { errcode?: unknown }
        if (typeof parsed.errcode === 'string') return parsed.errcode
      } catch {
        return null
      }
    }
  }
  return null
}
