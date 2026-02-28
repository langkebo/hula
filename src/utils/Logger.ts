import { info, warn, error, debug, trace } from '@tauri-apps/plugin-log'

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private context: string

  constructor(context: string = 'App') {
    this.context = context
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString()
    const formattedArgs = args.length > 0 ? ` ${args.map((a) => JSON.stringify(a)).join(' ')}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${formattedArgs}`
  }

  async log(message: string, ...args: unknown[]): Promise<void> {
    await info(this.formatMessage('info', message, ...args))
  }

  async debug(message: string, ...args: unknown[]): Promise<void> {
    await debug(this.formatMessage('debug', message, ...args))
  }

  async warn(message: string, ...args: unknown[]): Promise<void> {
    await warn(this.formatMessage('warn', message, ...args))
  }

  async error(message: string, ...args: unknown[]): Promise<void> {
    await error(this.formatMessage('error', message, ...args))
  }

  async trace(message: string, ...args: unknown[]): Promise<void> {
    await trace(this.formatMessage('trace', message, ...args))
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`)
  }
}

export const createLogger = (context: string): Logger => new Logger(context)

export const logger = new Logger('App')

export default logger
