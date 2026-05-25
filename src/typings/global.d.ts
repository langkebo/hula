declare global {
  interface Window {
    $message: import('naive-ui').MessageApi
    $dialog: import('naive-ui').DialogApi
    $notification: import('naive-ui').NotificationApi
    $loadingBar: import('naive-ui').LoadingBarApi
    $modal: import('naive-ui').ModalApi
    $invoke: (channel: string, payload?: unknown) => Promise<unknown>
    __HULA_RENDER_SAMPLES__?: import('@/utils/AppHarness').RenderSampleRecord[]
    hulaChatStore: any
    hulaGlobalStore: any
    hulaUserStore: any
    hulaRouter: any
    pinia: any
    __HULA_APP_READY__?: boolean
    __HULA_APP_READY_PHASE__?: 'booting' | 'mounted' | 'router-ready'
    __HULA_PINIA_READY__?: boolean
    __hula_cache_stats?: { size: number; maxSize: number; hitRate: number; hits: number; misses: number }
  }
}

interface ViewTransition {
  ready: Promise<void>
}

interface Document {
  startViewTransition?: (callback: () => Promise<void> | void) => ViewTransition
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

// 模块增强声明，以扩展 MatrixClient 类型
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { MatrixClientExtensionMethods } from 'matrix-js-sdk/src/matrix-client-extensions.d';

declare module 'matrix-js-sdk/src/client' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface MatrixClient extends MatrixClientExtensionMethods {}
}
