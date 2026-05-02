// biome-ignore-all lint/suspicious/noConsole: Worker logger must use console as Tauri Logger is unavailable in Worker context.

type LogLevel = 'info' | 'warn' | 'error'

function formatLogMessage(level: LogLevel, tag: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString().slice(11, 23)
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${tag}]`
  return `${prefix} ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
}

export function createWorkerLogger(tag: string) {
  return {
    info(...args: unknown[]) {
      console.log(formatLogMessage('info', tag, ...args))
    },
    warn(...args: unknown[]) {
      console.warn(formatLogMessage('warn', tag, ...args))
    },
    error(...args: unknown[]) {
      console.error(formatLogMessage('error', tag, ...args))
    }
  }
}
