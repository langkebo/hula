import {
  loadRobotAiProvider,
  loadRobotOpenClawConfig,
  loadRobotTrendRadarConfig,
  type RobotAiProvider,
  type RobotStorageScopeOptions,
  type StoredOpenClawConfig,
  type StoredTrendRadarConfig,
  saveRobotAiProvider,
  saveRobotOpenClawConfig,
  saveRobotTrendRadarConfig
} from '@/services/secure/robotAiProviderStorage'
import { createLogger } from '@/utils/Logger'
import type { RobotCredentialContext, RobotProviderCredentialSummary } from './types'

const logger = createLogger('RobotCredentialService')

class RobotCredentialService {
  private lastUpdatedAt = new Map<string, number>()

  createScope(context?: RobotCredentialContext): RobotStorageScopeOptions {
    return {
      userId: context?.userId
    }
  }

  private buildCredentialKey(context: RobotCredentialContext | undefined, provider: RobotAiProvider): string {
    return `${context?.userId || 'anonymous'}:${provider}`
  }

  private touch(context: RobotCredentialContext | undefined, provider: RobotAiProvider): number {
    const updatedAt = Date.now()
    this.lastUpdatedAt.set(this.buildCredentialKey(context, provider), updatedAt)
    return updatedAt
  }

  async loadProvider(context?: RobotCredentialContext): Promise<RobotAiProvider | null> {
    return loadRobotAiProvider(this.createScope(context))
  }

  async saveProvider(provider: RobotAiProvider, context?: RobotCredentialContext): Promise<void> {
    saveRobotAiProvider(provider, this.createScope(context))
    this.touch(context, provider)
  }

  async loadOpenClawConfig(
    defaults: StoredOpenClawConfig,
    context?: RobotCredentialContext
  ): Promise<StoredOpenClawConfig> {
    return loadRobotOpenClawConfig(defaults, this.createScope(context))
  }

  async saveOpenClawConfig(
    config: StoredOpenClawConfig,
    context?: RobotCredentialContext
  ): Promise<StoredOpenClawConfig> {
    const saved = await saveRobotOpenClawConfig(config, this.createScope(context))
    this.touch(context, 'openclaw')
    return saved
  }

  async loadTrendRadarConfig(
    defaults: StoredTrendRadarConfig,
    context?: RobotCredentialContext
  ): Promise<StoredTrendRadarConfig> {
    return loadRobotTrendRadarConfig(defaults, this.createScope(context))
  }

  async saveTrendRadarConfig(
    config: StoredTrendRadarConfig,
    context?: RobotCredentialContext
  ): Promise<StoredTrendRadarConfig> {
    const saved = await saveRobotTrendRadarConfig(config, this.createScope(context))
    this.touch(context, 'trendradar')
    return saved
  }

  getCredentialSummary(
    provider: RobotAiProvider,
    hasSecret: boolean,
    context?: RobotCredentialContext
  ): RobotProviderCredentialSummary {
    const key = this.buildCredentialKey(context, provider)
    return {
      provider,
      userId: context?.userId,
      hasSecret,
      updatedAt: this.lastUpdatedAt.get(key) ?? Date.now()
    }
  }

  maskSecret(secret: string): string {
    const normalized = secret.trim()
    if (!normalized) {
      return ''
    }
    if (normalized.length <= 8) {
      return `${normalized.slice(0, 2)}****`
    }
    return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`
  }

  logCredentialEvent(message: string, context?: RobotCredentialContext): void {
    logger.info(`${message} (userId: ${context?.userId || 'anonymous'})`)
  }
}

export const robotCredentialService = new RobotCredentialService()
