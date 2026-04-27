/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** 后端项目地址 */
  readonly VITE_SERVICE_URL: string
  /** 客户端项目地址 */
  readonly VITE_PC_URL: string
  /** 项目名称 */
  readonly VITE_APP_NAME: string
  /** Matrix Homeserver 地址 */
  readonly VITE_HOMESERVER_URL: string
  /** Matrix Identity Server 地址 */
  readonly VITE_IDENTITY_SERVER_URL?: string
  /** giteeToken */
  readonly VITE_GITEE_TOKEN: string
  /** Prometheus Pushgateway / ingest endpoint */
  readonly VITE_PROMETHEUS_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string

declare module '*.vue' {
  import { defineComponent } from 'vue'
  const Component: ReturnType<typeof defineComponent>
  export default component
}
/**使用 window.$message 来调用 Message 组件的方法。由于 TypeScript 编译器无法识别全局变量 $message 的类型，
我们可以使用 if (window.$message) 来进行判断，避免出现类型错误。*/
declare interface Window {
  $message: ReturnType<typeof useMessage>
  $notification: ReturnType<typeof useNotification>
  $loadingBar: ReturnType<typeof useLoadingBar>
  $dialog: ReturnType<typeof useDialog>
  $modal: ReturnType<typeof useModal>
  $invoke: (channel: string, payload?: unknown) => Promise<unknown>
  __HULA_RENDER_SAMPLES__?: import('@/utils/AppHarness').RenderSampleRecord[]
}
