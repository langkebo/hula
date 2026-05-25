import { createLogger } from '@/utils/Logger'

const logger = createLogger('ErrorTracker')

export interface ErrorContext {
  component?: string
  action?: string
  route?: string
  userId?: string
  sessionId?: string
  [key: string]: unknown
}

export interface TrackedError {
  type: 'unhandled' | 'promise' | 'vue' | 'manual'
  message: string
  stack?: string
  context: ErrorContext
  timestamp: number
  fingerprint: string
  count: number
  firstSeen: number
  lastSeen: number
}

interface ErrorTrackerConfig {
  maxStoredErrors: number
  dedupWindow: number
  enableGlobalHandlers: boolean
  reportToPerfReporter: boolean
}

const DEFAULT_CONFIG: ErrorTrackerConfig = {
  maxStoredErrors: 100,
  dedupWindow: 60000,
  enableGlobalHandlers: true,
  reportToPerfReporter: true
}

class ErrorTracker {
  private config: ErrorTrackerConfig = DEFAULT_CONFIG
  private errors: Map<string, TrackedError> = new Map()
  private initialized = false
  private originalOnError: OnErrorEventHandler | null = null
  private originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null

  initialize(config?: Partial<ErrorTrackerConfig>): void {
    if (this.initialized) {
      logger.warn('[ErrorTracker] 已经初始化，跳过重复调用')
      return
    }

    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initialized = true

    if (this.config.enableGlobalHandlers) {
      this.installGlobalHandlers()
    }

    logger.info('[ErrorTracker] 错误追踪已初始化')
  }

  private installGlobalHandlers(): void {
    if (typeof window === 'undefined') {
      logger.warn('[ErrorTracker] 当前环境不支持 window，跳过全局处理器安装')
      return
    }

    this.originalOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      this.trackError('unhandled', error ?? new Error(String(message)), {
        source: source ?? undefined,
        lineno,
        colno
      })

      if (this.originalOnError) {
        this.originalOnError(message, source, lineno, colno, error)
      }
    }

    this.originalOnUnhandledRejection = window.onunhandledrejection
    window.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      this.trackError('promise', error)

      if (this.originalOnUnhandledRejection) {
        this.originalOnUnhandledRejection(event)
      }
    }
  }

  private static readonly IGNORED_MESSAGES = [
    'ResizeObserver loop completed with undelivered notifications',
    'ResizeObserver loop limit exceeded',
    // Vite HMR SharedWorker 在 WKWebView (macOS Tauri) 中受限，仅开发模式出现
    'The operation is insecure',
    // Naive UI seemly/rgba 无法解析 CSS 变量，已在 NaiveProvider 中用具体色值修复
    '[seemly/rgba]: Invalid color value',
    // Tauri 窗口关闭后异步操作引用了已销毁的窗口，属于良性生命周期问题
    'window not found'
  ]

  trackError(type: TrackedError['type'], error: Error, context: ErrorContext = {}): void {
    // 过滤已知的良性浏览器警告
    if (ErrorTracker.IGNORED_MESSAGES.some((msg) => error.message.includes(msg))) {
      return
    }

    const fingerprint = this.computeFingerprint(error, context)
    const now = Date.now()
    const existing = this.errors.get(fingerprint)

    if (existing && now - existing.lastSeen < this.config.dedupWindow) {
      existing.count++
      existing.lastSeen = now
      return
    }

    const tracked: TrackedError = {
      type,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: now,
      fingerprint,
      count: existing ? existing.count + 1 : 1,
      firstSeen: existing ? existing.firstSeen : now,
      lastSeen: now
    }

    this.errors.set(fingerprint, tracked)
    this.enforceMaxErrors()

    if (type === 'unhandled' || type === 'promise') {
      logger.error(`[ErrorTracker] 未捕获${type === 'promise' ? ' Promise' : ''}错误:`, {
        message: error.message,
        fingerprint,
        context
      })
    }
  }

  trackVueError(error: Error, context: ErrorContext = {}): void {
    this.trackError('vue', error, context)
  }

  trackManual(message: string, context: ErrorContext = {}): void {
    this.trackError('manual', new Error(message), context)
  }

  getErrors(type?: TrackedError['type']): TrackedError[] {
    const all = Array.from(this.errors.values())
    if (type) {
      return all.filter((e) => e.type === type)
    }
    return all
  }

  getErrorCount(type?: TrackedError['type']): number {
    return this.getErrors(type).reduce((sum, e) => sum + e.count, 0)
  }

  getErrorSummary(): {
    total: number
    unhandled: number
    promise: number
    vue: number
    manual: number
    topErrors: TrackedError[]
  } {
    return {
      total: this.getErrorCount(),
      unhandled: this.getErrorCount('unhandled'),
      promise: this.getErrorCount('promise'),
      vue: this.getErrorCount('vue'),
      manual: this.getErrorCount('manual'),
      topErrors: this.getTopErrors(5)
    }
  }

  getTopErrors(limit: number): TrackedError[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  clearErrors(): void {
    this.errors.clear()
  }

  terminate(): void {
    if (typeof window !== 'undefined') {
      if (this.originalOnError) {
        window.onerror = this.originalOnError
      }
      if (this.originalOnUnhandledRejection) {
        window.onunhandledrejection = this.originalOnUnhandledRejection
      }
    }
    this.errors.clear()
    this.initialized = false
  }

  private computeFingerprint(error: Error, context: ErrorContext): string {
    const parts: string[] = [error.message]

    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3)
      parts.push(...stackLines)
    }

    if (context.component) {
      parts.push(context.component)
    }
    if (context.action) {
      parts.push(context.action)
    }

    return parts.join('|')
  }

  private enforceMaxErrors(): void {
    if (this.errors.size <= this.config.maxStoredErrors) return

    const sorted = Array.from(this.errors.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen)

    const toRemove = sorted.slice(0, this.errors.size - this.config.maxStoredErrors)
    for (const [key] of toRemove) {
      this.errors.delete(key)
    }
  }
}

export const errorTracker = new ErrorTracker()
