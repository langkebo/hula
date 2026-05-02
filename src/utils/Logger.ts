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

class Logger {
  private context: string
  private level: LogLevel = 'info'
  private static globalLevel: LogLevel = 'info'
  private static logToConsole: boolean = import.meta.env.DEV
  private static logToTauri: boolean = true

  constructor(context: string = 'App') {
    this.context = context
  }

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level
  }

  static getGlobalLevel(): LogLevel {
    return Logger.globalLevel
  }

  static setLogToConsole(enabled: boolean): void {
    Logger.logToConsole = enabled
  }

  static setLogToTauri(enabled: boolean): void {
    Logger.logToTauri = enabled
  }

  setLevel(level: LogLevel): this {
    this.level = level
    return this
  }

  private shouldLog(level: LogLevel): boolean {
    const currentPriority = LogLevelPriority[this.level]
    const globalPriority = LogLevelPriority[Logger.globalLevel]
    const messagePriority = LogLevelPriority[level]
    return messagePriority >= Math.max(currentPriority, globalPriority)
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
      result = result.replace(pattern, (match, ...groups) => {
        const patternStr = pattern.source.toLowerCase()
        if (patternStr.includes('phone') || patternStr.includes('mobile')) {
          return match.replace(groups[0] + groups[1], `${groups[0]}****${groups[1]}`)
        }
        if (patternStr.includes('email') || patternStr.includes('mail')) {
          return match.replace(groups[0] + groups[1], `${groups[0]}***`)
        }
        if (match.length <= 12) return match
        // For generic tokens, keep a small prefix if it's long
        const replacement =
          match.includes(':') || match.includes('=') ? match.split(/[:=]/)[0] + ': [REDACTED]' : '[REDACTED]'
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

  private formatConsoleMessage(level: LogLevel, message: string, ...args: unknown[]): [string, ...unknown[]] {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`
    return [`${prefix} ${message}`, ...args]
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
    } catch {
      // Tauri log plugin may not be available in some environments
    }
  }

  private logWithLevel(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return

    if (Logger.logToConsole) {
      const [_consoleMessage, ..._consoleArgs] = this.formatConsoleMessage(level, message, ...args)
      switch (level) {
        case 'trace':
        case 'debug':
          break
        case 'info':
          break
        case 'warn':
          break
        case 'error':
          break
      }
    }

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

  error(message: string, error?: unknown, ...args: unknown[]): void {
    const errorArgs = error !== undefined ? [error, ...args] : args
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

  time(_label: string): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
    }
  }

  timeEnd(_label: string): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
    }
  }

  group(_label: string): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
    }
  }

  groupEnd(): void {
    if (Logger.logToConsole) {
    }
  }

  table(_data: unknown, _columns?: string[]): void {
    if (Logger.logToConsole && this.shouldLog('debug')) {
    }
  }
}

export const createLogger = (context: string): Logger => new Logger(context)

export const logger = new Logger('App')

export default logger
