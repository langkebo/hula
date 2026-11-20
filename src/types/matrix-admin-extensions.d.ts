import type {
  AdminIpBlock,
  AdminIpReputation,
  AdminLoginFailure,
  AdminSecurityEvent,
  AdminServerLogEntry
} from '@/services/matrix/admin/AdminTypes'
import type { SamlMapping, SamlMappingPage } from '@/services/matrix/sdk'

declare module 'matrix-js-sdk/admin' {
  interface AdminManager {
    // ==================== SAML ====================
    getSamlConfig(): Promise<Record<string, unknown>>
    getSamlMetadata(): Promise<Record<string, unknown>>
    getSpMetadata(): Promise<Blob | string | null>
    updateSamlConfig(config: Record<string, unknown>): Promise<void>
    refreshIdpMetadata(): Promise<Record<string, unknown>>
    listSamlMappings(options: { limit?: number; from?: string }): Promise<SamlMappingPage>
    getSamlMapping(nameId: string): Promise<SamlMapping | null>
    updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void>
    deleteSamlMapping(nameId: string): Promise<void>
    samlLogout(userId: string): Promise<void>

    // ==================== Security Events ====================
    listSecurityEvents(params: Record<string, unknown>): Promise<{
      events: AdminSecurityEvent[]
      next_token?: string
    }>

    // ==================== IP Blocks ====================
    listIpBlocks(): Promise<AdminIpBlock[] | null>
    blockIp(ip: string, options: { cidr?: number; expire_at?: number; reason?: string }): Promise<AdminIpBlock | null>
    unblockIp(ip: string): Promise<void>
    getIpReputation(ip: string): Promise<AdminIpReputation | null>

    // ==================== Server ====================
    updateServerConfig(config: Record<string, unknown>): Promise<void>
    getServerLogs(params: { level?: string; limit?: number }): Promise<AdminServerLogEntry[] | null>

    // ==================== User Security ====================
    listLoginFailures(options: { limit?: number; from?: string }): Promise<{
      failures: AdminLoginFailure[]
      next_token?: string
    }>
  }
}
