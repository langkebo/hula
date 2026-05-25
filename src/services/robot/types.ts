import type {
  RobotAiProvider,
  RobotStorageScopeOptions,
  StoredTrendRadarConfig
} from '@/services/secure/robotAiProviderStorage'

export type RobotProviderType = RobotAiProvider

export type RobotRuntimeStatus = 'idle' | 'running' | 'thinking' | 'degraded' | 'paused' | 'error' | 'offline'

export type RobotMessageKind = 'text' | 'rich_text' | 'link_card' | 'task_card' | 'system_notice' | 'tool_result'

export type RobotDeliveryMode = 'room' | 'reply' | 'thread_reply'

export type RobotSecurityLevel = 'private' | 'room' | 'system'

export interface RobotUserScope extends RobotStorageScopeOptions {
  userId?: string
}

export interface RobotCredentialContext {
  userId?: string
}

export interface RobotProviderCredentialSummary {
  provider: RobotProviderType
  userId?: string
  hasSecret: boolean
  updatedAt: number
}

export interface RobotTrendRadarCredential extends StoredTrendRadarConfig {
  provider: 'trendradar'
  userId?: string
}

export interface RobotDefinition {
  id: string
  name: string
  description?: string
  provider: RobotProviderType
  supportsRoomDeployment: boolean
  supportedMessageKinds: RobotMessageKind[]
  requiredPermissions?: string[]
  version?: string
}

export interface RobotInstance {
  id: string
  roomId: string
  botId: string
  ownerUserId?: string
  status: RobotRuntimeStatus
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface RobotPresenceSnapshot {
  roomId: string
  botId: string
  status: RobotRuntimeStatus
  lastActiveAt: number
  message?: string
}

export interface RobotDispatchMessage {
  traceId: string
  roomId: string
  botId: string
  kind: RobotMessageKind
  body: string
  formattedBody?: string
  metadata?: Record<string, unknown>
}

export interface RobotDispatchResult {
  traceId: string
  roomId: string
  botId: string
  delivered: boolean
  eventId?: string
  error?: string
}

export interface RobotProtocolEnvelope {
  version: '1.0'
  botId: string
  botName: string
  messageType: RobotMessageKind
  traceId: string
  deliveryMode: RobotDeliveryMode
  securityLevel: RobotSecurityLevel
  sourceEventId?: string
  threadRootId?: string
  source?: string
}

export interface RobotConversationRecord {
  id: string
  roomId?: string
  botId: string
  userId?: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  metadata?: Record<string, unknown>
}

export interface RobotPermissionDescriptor {
  roomId?: string
  botId?: string
  userId?: string
  permission: string
  allowed: boolean
  reason?: string
}

export interface RobotAuditEvent {
  id: string
  type: string
  actorUserId?: string
  roomId?: string
  botId?: string
  traceId?: string
  payload?: Record<string, unknown>
  createdAt: number
}

export interface RobotPluginModule {
  definition: RobotDefinition
  activate?: () => Promise<void> | void
  deactivate?: () => Promise<void> | void
}
