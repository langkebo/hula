type LoggerLike = {
  getLogger?: (name?: string) => LoggerLike
  setLevel?: (...args: unknown[]) => void
  methodFactory?: (...args: unknown[]) => unknown
  rebuild?: () => void
  // matrix-js-sdk 在模块顶层执行 logger.log.bind(logger)，缺 log 会直接抛
  // Cannot read properties of undefined (reading 'bind')。
  log?: (...args: unknown[]) => void
  trace?: (...args: unknown[]) => void
  debug?: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

// matrix-js-sdk 的 logger 会读取 loglevel.levels.DEBUG 并调用 setLevel/rebuild，
// 缺失这些字段会让每个 story 在渲染期抛错，因此 mock 必须保持与真实 API 形状一致。
export const levels = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
}

const createLogger = (): LoggerLike => ({
  getLogger: () => createLogger(),
  setLevel: () => undefined,
  methodFactory: () => undefined,
  rebuild: () => undefined,
  log: () => undefined,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
})

const rootLogger = createLogger()

export const getLogger = () => createLogger()
export const setLevel = () => undefined
export const setDefaultLevel = () => undefined
export const enableAll = () => undefined
export const disableAll = () => undefined

export default { ...rootLogger, levels, getLogger, setLevel, setDefaultLevel, enableAll, disableAll }
