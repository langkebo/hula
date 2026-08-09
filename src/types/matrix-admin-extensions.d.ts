/**
 * matrix-js-sdk/admin AdminManager 类型扩展
 *
 * synapse-rust 后端在 AdminManager 上通过 ES Proxy 暴露了 SAML/安全事件/
 * IP 封禁/服务器日志/登录失败等扩展方法，但上游 SDK 的 AdminManager
 * 接口未包含这些方法签名。此处通过 declaration merging 补全类型定义，
 * 消除生产代码中的 as any 类型逃逸。
 *
 * 方法运行时通过 AdminManager 构造器返回的 ES Proxy 路由到对应子 Manager。
 */

// top-level export makes this a module (not ambient script), so declare module
// acts as augmentation (merging) rather than replacement.
export {}

declare module 'matrix-js-sdk/admin' {
  interface AdminManager {
    // ==================== SAML ====================
    getSamlConfig(): Promise<Record<string, unknown>>
    getSamlMetadata(): Promise<Record<string, unknown>>
    getSpMetadata(): Promise<Blob | string | null>
    updateSamlConfig(config: Record<string, unknown>): Promise<void>
    refreshIdpMetadata(): Promise<Record<string, unknown>>
    listSamlMappings(options: { limit?: number; from?: string }): Promise<{
      mappings: Array<Record<string, unknown>>
      next_token?: string
    }>
    getSamlMapping(nameId: string): Promise<Record<string, unknown> | null>
    updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void>
    deleteSamlMapping(nameId: string): Promise<void>
    samlLogout(userId: string): Promise<void>

    // ==================== Security Events ====================
    listSecurityEvents(params: Record<string, unknown>): Promise<{
      events: Array<Record<string, unknown>>
      next_token?: string
    }>

    // ==================== IP Blocks ====================
    listIpBlocks(): Promise<Array<Record<string, unknown>> | null>
    blockIp(
      ip: string,
      options: { cidr?: number; expire_at?: number; reason?: string }
    ): Promise<Record<string, unknown> | null>
    unblockIp(ip: string): Promise<void>
    getIpReputation(ip: string): Promise<Record<string, unknown> | null>

    // ==================== Server ====================
    updateServerConfig(config: Record<string, unknown>): Promise<void>
    getServerLogs(params: { level?: string; limit?: number }): Promise<Array<Record<string, unknown>> | null>

    // ==================== User Security ====================
    listLoginFailures(options: { limit?: number; from?: string }): Promise<{
      failures: Array<Record<string, unknown>>
      next_token?: string
    }>
  }
}
