import { createLogger } from '@/utils/Logger'

const logger = createLogger('ErrorReporter')

export interface ErrorReport {
  message: string
  stack?: string
  context?: string
  timestamp: number
  url?: string
  userAgent?: string
  extra?: Record<string, unknown>
}

export interface ErrorReporterConfig {
  dsn?: string
  environment?: string
  release?: string
  enabled?: boolean
}

class ErrorReporter {
  private config: ErrorReporterConfig = {
    enabled: false
  }

  private queue: ErrorReport[] = []
  private maxQueueSize = 50

  configure(config: ErrorReporterConfig) {
    this.config = { ...this.config, ...config }
    logger.info('Error reporter configured:', { enabled: this.config.enabled })
  }

  async report(error: unknown, context?: string, extra?: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled) {
      logger.debug('Error reporting disabled, skipping:', error)
      return
    }

    const report: ErrorReport = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      extra
    }

    this.queue.push(report)

    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift()
    }

    if (this.config.dsn) {
      await this.sendReport(report)
    } else {
      logger.warn('No DSN configured, error queued:', report.message)
    }
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    if (!this.config.dsn) return

    try {
      const response = await fetch(this.config.dsn, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...report,
          environment: this.config.environment,
          release: this.config.release
        })
      })

      if (!response.ok) {
        logger.error('Failed to send error report:', response.status)
      }
    } catch (e) {
      logger.error('Error sending report:', e)
    }
  }

  getQueue(): ErrorReport[] {
    return [...this.queue]
  }

  clearQueue(): void {
    this.queue = []
  }
}

export const errorReporter = new ErrorReporter()

export function reportError(error: unknown, context?: string, extra?: Record<string, unknown>): void {
  errorReporter.report(error, context, extra)
}
