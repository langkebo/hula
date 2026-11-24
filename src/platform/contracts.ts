import type { BaseDirectory } from '@tauri-apps/plugin-fs'
import type { AsyncComponentLoader, Component, ComputedRef } from 'vue'
import type { CallTypeEnum } from '@/enums'

/**
 * 作用域路径候选：相对路径落在该基目录下时，用 baseDir 交给后端/插件解析。
 */
export interface StorageBaseDirCandidate {
  baseDir: BaseDirectory
  resolvePath: () => Promise<string>
}

/**
 * 平台存储布局契约。
 * 移动端只有应用私有数据目录（AppData）可写，桌面端下载目录为 Resource、
 * 缓存目录为 AppCache，并按 AppData → AppCache → Resource 依次解析作用域路径。
 */
export interface StorageLayout {
  downloadBaseDir: BaseDirectory
  resolveDownloadBaseDirPath: () => Promise<string>
  cacheBaseDir: BaseDirectory
  cacheBaseDirName: string
  scopedBaseDirs: StorageBaseDirCandidate[]
}

/**
 * 移动端能力存在性契约。
 * 两个能力在构建期即确定：桌面产物恒为 false / undefined，移动产物恒为 true / 异步组件，
 * 因此调用方不再需要在运行期判断平台。
 */
export interface MobilePresence {
  useIsMobile: () => ComputedRef<boolean>
  mobileOnlyAsyncComponent: <T extends Component>(loader: AsyncComponentLoader<T>) => T | undefined
}

/**
 * 平台启动收尾契约。
 * 移动端负责 eruda 调试器与 splash 的 frontend 完成信号，桌面端为空实现。
 */
export interface PlatformBoot {
  afterPlatformInitialize: () => void
  /**
   * 应用根组件 setup 阶段调用。
   * 此时已进入组件上下文且 pinia / i18n 已安装，可安全创建依赖 useI18n 的 store
   * （移动端图标角标监听需要在此启动，早于组件上下文的调用会抛 MUST_BE_CALL_SETUP_TOP）。
   */
  afterAppSetup?: () => void
}

/**
 * 旧 WS 来电请求载荷（矩阵来电统一走 Matrix Call.incoming）。
 */
export interface LegacyVideoCallPayload {
  callerUid: string
  isVideo: boolean
}

/**
 * 旧 WS 来电消费方，由 useWsEventHandler 注入。
 */
export interface LegacyVideoCallHandler {
  handleVideoCall: (callerUid: string, callType: CallTypeEnum) => void
}

/**
 * 账号在其他设备登录时的处理上下文。
 */
export interface RemoteLoginExpiredContext {
  remoteIp?: string
  logout: () => Promise<void>
  onLoggedOut: () => void
}

/**
 * 平台会话事件策略契约。
 * 桌面端保留旧 WS 来电链路并聚焦主窗口弹登录窗，移动端屏蔽旧来电并跳转移动登录页。
 */
export interface SessionEventStrategy {
  handleLegacyVideoCall: (payload: LegacyVideoCallPayload, handler: LegacyVideoCallHandler) => void
  handleRemoteLoginExpired: (context: RemoteLoginExpiredContext) => Promise<void>
}
