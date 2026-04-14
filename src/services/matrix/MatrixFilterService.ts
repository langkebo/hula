/**
 * Matrix 过滤器服务
 *
 * 封装 SDK FilterManager，提供同步过滤器管理功能
 *
 * 功能:
 * - 创建和管理同步过滤器
 * - 优化同步性能
 * - 减少带宽消耗
 */

import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface SdkFilterDefinition {
  room?: {
    state?: {
      types?: string[]
      not_types?: string[]
      limit?: number
      lazy_load_members?: boolean
    }
    timeline?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
    ephemeral?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
    account_data?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
  }
  presence?: {
    types?: string[]
    not_types?: string[]
    limit?: number
  }
  account_data?: {
    types?: string[]
    not_types?: string[]
    limit?: number
  }
  event_format?: 'client' | 'federation'
  event_fields?: string[]
}

export interface SyncFilterConfig {
  room?: {
    state?: {
      types?: string[]
      not_types?: string[]
      limit?: number
      lazy_load_members?: boolean
    }
    timeline?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
    ephemeral?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
    account_data?: {
      types?: string[]
      not_types?: string[]
      limit?: number
    }
  }
  presence?: {
    types?: string[]
    not_types?: string[]
    limit?: number
  }
  account_data?: {
    types?: string[]
    not_types?: string[]
    limit?: number
  }
  event_format?: 'client' | 'federation'
  event_fields?: string[]
}

export interface FilterPreset {
  id: string
  name: string
  description: string
  definition: SyncFilterConfig
}

const DEFAULT_FILTER: SyncFilterConfig = {
  room: {
    state: {
      lazy_load_members: true
    },
    timeline: {
      limit: 50
    },
    ephemeral: {
      limit: 50
    }
  },
  presence: {
    limit: 0
  }
}

const PRESETS: FilterPreset[] = [
  {
    id: 'default',
    name: '默认过滤器',
    description: '平衡性能和功能',
    definition: DEFAULT_FILTER
  },
  {
    id: 'performance',
    name: '性能优先',
    description: '最小化同步数据量',
    definition: {
      room: {
        state: {
          lazy_load_members: true,
          limit: 10
        },
        timeline: {
          limit: 20
        },
        ephemeral: {
          limit: 10
        }
      },
      presence: {
        limit: 0
      }
    }
  },
  {
    id: 'full',
    name: '完整同步',
    description: '同步所有数据',
    definition: {
      room: {
        state: {},
        timeline: {
          limit: 100
        }
      },
      presence: {
        limit: 100
      }
    }
  }
]

class MatrixFilterService extends BaseManager {
  private filterManager: any = null
  private initialized = false
  private currentFilterId: string | null = null
  private currentFilterName = 'hula-sync-filter'

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.filterManager = (client as any).getFilterManager?.() ?? null
      if (this.filterManager) {
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_error) {
      // error logged by handleError
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.filterManager) {
      this.initialize()
    }
    if (!this.filterManager) {
      throw new Error('过滤器服务未初始化')
    }
  }

  async createFilter(definition: SyncFilterConfig = DEFAULT_FILTER): Promise<string> {
    this.ensureInitialized()

    const result = await this.filterManager!.createFilter(definition as SdkFilterDefinition)
    this.currentFilterId = result.filterId

    return result.filterId
  }

  async getFilter(filterId: string, allowCached = true): Promise<any> {
    this.ensureInitialized()

    const userId = matrixClientService.getClient()?.getUserId()
    if (!userId) {
      throw new Error('用户 ID 未获取')
    }

    return await this.filterManager!.getFilter(userId, filterId, allowCached)
  }

  async getOrCreateFilter(name: string, definition: SyncFilterConfig): Promise<string> {
    this.ensureInitialized()

    const userId = matrixClientService.getClient()?.getUserId()
    if (!userId) {
      throw new Error('用户 ID 未获取')
    }

    const filter = await this.filterManager!.getOrCreateFilter(name, definition as SdkFilterDefinition)

    this.currentFilterId = filter
    this.currentFilterName = name

    return filter
  }

  async applyPreset(presetId: string): Promise<string> {
    const preset = PRESETS.find((p) => p.id === presetId)
    if (!preset) {
      throw new Error(`未找到预设: ${presetId}`)
    }

    return await this.getOrCreateFilter(`hula-${presetId}`, preset.definition)
  }

  async applyDefaultFilter(): Promise<string> {
    return await this.getOrCreateFilter(this.currentFilterName, DEFAULT_FILTER)
  }

  async applyPerformanceFilter(): Promise<string> {
    return await this.applyPreset('performance')
  }

  async applyFullSyncFilter(): Promise<string> {
    return await this.applyPreset('full')
  }

  getPresets(): FilterPreset[] {
    return [...PRESETS]
  }

  getPreset(id: string): FilterPreset | undefined {
    return PRESETS.find((p) => p.id === id)
  }

  getCurrentFilterId(): string | null {
    return this.currentFilterId
  }

  getCurrentFilterName(): string {
    return this.currentFilterName
  }

  getDefaultFilter(): SyncFilterConfig {
    return { ...DEFAULT_FILTER }
  }

  createCustomFilter(config: Partial<SyncFilterConfig>): SyncFilterConfig {
    return {
      ...DEFAULT_FILTER,
      ...config,
      room: {
        ...DEFAULT_FILTER.room,
        ...config.room
      }
    }
  }

  async validateFilter(definition: SyncFilterConfig): Promise<boolean> {
    try {
      if (this.filterManager) {
        await this.filterManager.createFilter(definition as SdkFilterDefinition)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  stop(): void {
    this.filterManager = null
    this.initialized = false
    this.currentFilterId = null
  }
}

export const matrixFilterService = new MatrixFilterService()
export default matrixFilterService
