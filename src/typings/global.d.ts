interface ViewTransition {
  ready: Promise<void>
}

interface Document {
  startViewTransition?: (callback: () => Promise<void> | void) => ViewTransition
}

interface PromiseConstructor {
  withResolvers<T>(): {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
  }
}

type PromiseWithResolvers<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

interface Uint8ArrayToBase64Options {
  alphabet?: 'base64' | 'base64url'
  omitPadding?: boolean
}

interface Uint8ArrayFromBase64Options {
  alphabet?: 'base64'
  lastChunkHandling?: 'loose'
}

interface Uint8Array {
  toBase64?(options?: Uint8ArrayToBase64Options): string
}

interface Uint8ArrayConstructor {
  fromBase64?(base64: string, options?: Uint8ArrayFromBase64Options): Uint8Array<ArrayBuffer>
}

/** 通用类型 */
declare namespace Common {
  /**
   * 策略模式
   * [状态, 为true时执行的回调函数]
   */
  type StrategyAction = [boolean, () => void]

  /** 选项数据 */
  type OptionWithKey<K> = { value: K; label: string }
}

/** 构建时间 */
declare const PROJECT_BUILD_TIME: string

declare module 'eruda' {
  const eruda: { init: (options?: unknown) => void }
  export default eruda
}

export type ProxySettings = {
  apiType: string
  apiIp: string
  apiPort: string
  apiSuffix: string
  wsType: string
  wsIp: string
  wsPort: string
  wsSuffix: string
}

export type MsgId = {
  msgId: string
  fromUid: string
}
