type LoggerLike = {
  getLogger?: (name?: string) => LoggerLike
  setLevel?: (...args: unknown[]) => void
  methodFactory?: (...args: unknown[]) => unknown
  trace?: (...args: unknown[]) => void
  debug?: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

const createLogger = (): LoggerLike => {
  const logger: LoggerLike = {
    getLogger: () => createLogger(),
    setLevel: () => undefined,
    methodFactory: () => undefined,
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  }

  return logger
}

export default createLogger()
