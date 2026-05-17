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
