/**
 * OpenClaw 服务导出
 *
 * 仿飞书插件架构的 OpenClaw 客户端
 */

export type { OpenClawInstallResult, OpenClawInstallStatus } from './OpenClawInstallService'
export { openClawInstallService } from './OpenClawInstallService'
export type {
  OpenClawConfig,
  OpenClawMessage,
  StreamChunk
} from './OpenClawService'
export { ConnectionState, openClawClient, useOpenClaw } from './OpenClawService'
