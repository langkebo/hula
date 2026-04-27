import { info, warn, error, debug, trace } from '@tauri-apps/plugin-log'

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
    /(?:access_token|Authorization:\s*Bearer\s+)([a-zA-Z0-9_\-.~+/=]{8,})/gi,
    /(?:syt_)[a-zA-Z0-9_\-.]{10,}/g
  ]

  private static sanitize(text: string): string {
    let result = text
    for (const pattern of Logger.sanitizePatterns) {
      result = result.replace(pattern, (match) => {
        if (match.length <= 12) return match
        return match.slice(0, 8) + '***REDACTED***'
      })
    }
    return result
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString()
    const formattedArgs =
      args.length > 0 ? ` ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}` : ''
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
