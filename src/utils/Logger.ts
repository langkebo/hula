import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off'

export const LogLevelPriority: Record<LogLevel, number> = {
  off: 100,
  error: 4,
  warn: 3,
  info: 2,
  debug: 1,
  trace: 0
}

const DEDUP_WINDOW_MS = 5000
const DEDUP_WINDOW_ERROR_MS = 30000
const DEDUP_CACHE_SIZE = 200
const THROTTLE_BURST = 5
const THROTTLE_INTERVAL_MS = 1000

interface DedupEntry {
  hash: string
  time: number
  count: number
}

interface ThrottleTracker {
  count: number
  windowStart: number
}

const CONSOLE_STYLES: Record<string, string> = {
  trace: 'color: #888',
  debug: 'color: #4a9eff',
  info: 'color: #00c853',
  warn: 'color: #ff9800; font-weight: bold',
  error: 'color: #f44336; font-weight: bold'
}

let envLogLevel: LogLevel | null = null

function resolveEnvLogLevel(): LogLevel {
  if (envLogLevel !== null) return envLogLevel

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const env = import.meta.env.VITE_LOG_LEVEL as string | undefined
      if (env) {
        const lower = env.toLowerCase()
        if (['trace', 'debug', 'info', 'warn', 'error', 'off'].includes(lower)) {
          envLogLevel = lower as LogLevel
          return envLogLevel
        }
      }
    }
  } catch {}

  envLogLevel = 'info'
  return envLogLevel
}

function resolveDefaultLevel(): LogLevel {
  const env = resolveEnvLogLevel()
  if (env !== 'info') return env

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
      return 'warn'
    }
  } catch {}

  return 'info'
}

class Logger {
  private context: string
  private level: LogLevel
  private static globalLevel: LogLevel | null = null
  private static logToConsole: boolean = true
  private static logToTauri: boolean = true
  private static dedupCache: DedupEntry[] = []
  private static throttleTrackers: Map<string, ThrottleTracker> = new Map()
  private static dedupEnabled: boolean = import.meta.env?.PROD !== true
  private static throttleEnabled: boolean = import.meta.env?.PROD !== true

  constructor(context: string = 'App') {
    this.context = context
    this.level = resolveDefaultLevel()
  }

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level
  }

  static getGlobalLevel(): LogLevel {
    return Logger.globalLevel ?? resolveDefaultLevel()
  }

  static setLogToConsole(enabled: boolean): void {
    Logger.logToConsole = enabled
  }

  static setLogToTauri(enabled: boolean): void {
    Logger.logToTauri = enabled
  }

  static setDedupEnabled(enabled: boolean): void {
    Logger.dedupEnabled = enabled
  }

  static setThrottleEnabled(enabled: boolean): void {
    Logger.throttleEnabled = enabled
  }

  setLevel(level: LogLevel): this {
    this.level = level
    return this
  }

  getLevel(): LogLevel {
    return this.level
  }

  private shouldLog(level: LogLevel): boolean {
    const currentPriority = LogLevelPriority[this.level]
    const globalLevel = Logger.globalLevel ?? resolveDefaultLevel()
    const globalPriority = LogLevelPriority[globalLevel]
    const messagePriority = LogLevelPriority[level]
    return messagePriority >= Math.max(currentPriority, globalPriority)
  }

  private static simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0
    }
    return hash.toString(36)
  }

  private isDuplicate(level: LogLevel, message: string): boolean {
    if (!Logger.dedupEnabled) return false

    const hash = Logger.simpleHash(`${this.context}:${level}:${message}`)
    const now = Date.now()
    const windowMs = level === 'error' ? DEDUP_WINDOW_ERROR_MS : DEDUP_WINDOW_MS

    const existing = Logger.dedupCache.find((e) => e.hash === hash)
    if (existing) {
      if (now - existing.time < windowMs) {
        existing.count++
        if (existing.count === 2 || existing.count % 50 === 0) {
          return false
        }
        return true
      }
      existing.time = now
      existing.count = 1
      return false
    }

    Logger.dedupCache.unshift({ hash, time: now, count: 1 })
    if (Logger.dedupCache.length > DEDUP_CACHE_SIZE) {
      Logger.dedupCache.length = DEDUP_CACHE_SIZE
    }
    return false
  }

  private isThrottled(level: LogLevel): boolean {
    if (!Logger.throttleEnabled) return false
    if (level === 'error' || level === 'warn') return false

    const now = Date.now()
    const key = `__global_${level}`
    const tracker = Logger.throttleTrackers.get(key)

    if (!tracker || now - tracker.windowStart > THROTTLE_INTERVAL_MS) {
      Logger.throttleTrackers.set(key, { count: 1, windowStart: now })
      return false
    }

    if (tracker.count >= THROTTLE_BURST) {
      return true
    }

    tracker.count++
    return false
  }

  private static sanitizePatterns: RegExp[] = [
    /(?:access_token|accessToken|id_access_token|token)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-.~+/=]{8,})/gi,
    /(?:refresh_token|refreshToken)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-.~+/=]{8,})/gi,
    /(?:Authorization:\s*Bearer\s+)([a-zA-Z0-9_\-.~+/=]{8,})/gi,
    /(?:syt_)[a-zA-Z0-9_\-.]{10,}/g,
    /(?:password|passwd|pwd|pass)["']?\s*[:=]\s*["']?([^\s"'`,;]{4,})/gi,
    /(?:phone|mobile|cellphone)["']?\s*[:=]\s*["']?(\d{3})\d{4}(\d{4})/gi,
    /(?:email|mail)["']?\s*[:=]\s*["']?([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)@/gi,
    /(?:recovery_key|recoveryKey|secret_storage_key|secretStorageKey)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-.~+/=]{8,})/gi,
    /(?:device_id|deviceId)["']?\s*[:=]\s*["']?([A-Z0-9]{8,})/gi,
    /(?:session_id|sid|session_key)["']?\s*[:=]\s*["']?([a-zA-Z0-9_\-.~+/=]{8,})/gi
  ]

  private static SENSITIVE_KEYS = [
    'token',
    'password',
    'passwd',
    'pwd',
    'pass',
    'secret',
    'key',
    'auth',
    'session',
    'sid',
    'phone',
    'mobile',
    'email'
  ]

  private static redactObject(obj: unknown, depth = 0): unknown {
    if (depth > 5) return '[DEPTH_EXCEEDED]'
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map((item) => Logger.redactObject(item, depth + 1))

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase()
      if (Logger.SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
        if (typeof value === 'string' && value.length > 4) {
          if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
            result[key] = `${value.slice(0, 3)}****${value.slice(-4)}`
          } else if (lowerKey.includes('email')) {
            const [user, domain] = value.split('@')
            result[key] = `${user?.slice(0, 1)}***@${domain}`
          } else {
            result[key] = '[REDACTED]'
          }
        } else {
          result[key] = '[REDACTED]'
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = Logger.redactObject(value, depth + 1)
      } else {
        result[key] = value
      }
    }
    return result
  }

  private static sanitize(text: string): string {
    let result = text
    for (const pattern of Logger.sanitizePatterns) {
      result = result.replace(pattern, (_match, ...groups) => {
        const patternStr = pattern.source.toLowerCase()
        if (patternStr.includes('phone') || patternStr.includes('mobile')) {
          return _match.replace(groups[0] + groups[1], `${groups[0]}****${groups[1]}`)
        }
        if (patternStr.includes('email') || patternStr.includes('mail')) {
          return _match.replace(groups[0] + groups[1], `${groups[0]}***`)
        }
        if (_match.length <= 12) return _match
        const replacement =
          _match.includes(':') || _match.includes('=') ? _match.split(/[:=]/)[0] + ': [REDACTED]' : '[REDACTED]'
        return replacement
      })
    }
    return result
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString()
    const redactedArgs = args.map((a) => Logger.redactObject(a))
    const formattedArgs =
      redactedArgs.length > 0
        ? ` ${redactedArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
        : ''
    const raw = `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${formattedArgs}`
    return Logger.sanitize(raw)
  }

  private writeConsole(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!Logger.logToConsole) return

    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    const style = CONSOLE_STYLES[level] || ''
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`

    const consoleArgs: unknown[] = [`%c${prefix}`, style, message, ...args]

    switch (level) {
      case 'trace':
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.trace(...consoleArgs)
        break
      case 'debug':
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.debug(...consoleArgs)
        break
      case 'info':
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.info(...consoleArgs)
        break
      case 'warn':
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.warn(...consoleArgs)
        break
      case 'error':
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.error(...consoleArgs)
        break
    }
  }

  private async logToTauriPlugin(level: LogLevel, formattedMessage: string): Promise<void> {
    if (!Logger.logToTauri) return

    try {
      switch (level) {
        case 'trace':
          await trace(formattedMessage)
          break
        case 'debug':
          await debug(formattedMessage)
          break
        case 'info':
          await info(formattedMessage)
          break
        case 'warn':
          await warn(formattedMessage)
          break
        case 'error':
          await error(formattedMessage)
          break
      }
    } catch {}
  }

  private logWithLevel(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return

    if (this.isDuplicate(level, message)) return

    if (this.isThrottled(level)) return

    this.writeConsole(level, message, ...args)

    const formattedMessage = this.formatMessage(level, message, ...args)
    this.logToTauriPlugin(level, formattedMessage)
  }

  trace(message: string, ...args: unknown[]): void {
    this.logWithLevel('trace', message, ...args)
  }

  debug(message: string, ...args: unknown[]): void {
    this.logWithLevel('debug', message, ...args)
  }

  info(message: string, ...args: unknown[]): void {
    this.logWithLevel('info', message, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    this.logWithLevel('warn', message, ...args)
  }

  error(message: string, errorObj?: unknown, ...args: unknown[]): void {
    const errorArgs = errorObj !== undefined ? [errorObj, ...args] : args
    this.logWithLevel('error', message, ...errorArgs)
  }

  log(message: string, ...args: unknown[]): void {
    this.info(message, ...args)
  }

  child(context: string): Logger {
    const childLogger = new Logger(`${this.context}:${context}`)
    childLogger.level = this.level
    return childLogger
  }

  time(label: string): void {
    if (this.shouldLog('debug')) {
      const key = `__time_${this.context}_${label}`
      ;(console as unknown as Record<string, unknown>)[key] = performance.now()
      if (Logger.logToConsole) {
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.debug(`[${this.context}] ⏱ ${label} — start`)
      }
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('debug')) {
      const key = `__time_${this.context}_${label}`
      const start = (console as unknown as Record<string, unknown>)[key] as number | undefined
      if (start !== undefined) {
        const elapsed = (performance.now() - start).toFixed(1)
        if (Logger.logToConsole) {
          // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
          console.debug(`[${this.context}] ⏱ ${label} — ${elapsed}ms`)
        }
        delete (console as unknown as Record<string, unknown>)[key]
      }
    }
  }

  group(_label: string): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
      // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
      console.group(_label)
    }
  }

  groupEnd(): void {
    if (Logger.logToConsole) {
      // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
      console.groupEnd()
    }
  }

  table(_data: unknown, columns?: string[]): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
      if (columns) {
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.table(_data, columns)
      } else {
        // biome-ignore lint/suspicious/noConsole: Logger is a logging utility
        console.table(_data)
      }
    }
  }
}

export function configureLogger(options: { level?: LogLevel; logToConsole?: boolean; logToTauri?: boolean }): void {
  if (options.level !== undefined) {
    Logger.setGlobalLevel(options.level)
    envLogLevel = options.level
  }
  if (options.logToConsole !== undefined) {
    Logger.setLogToConsole(options.logToConsole)
  }
  if (options.logToTauri !== undefined) {
    Logger.setLogToTauri(options.logToTauri)
  }
}

export const createLogger = (context: string): Logger => new Logger(context)

export const logger = new Logger('App')

export default logger
