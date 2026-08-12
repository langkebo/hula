import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { MatrixCapabilities } from '@/types/message'

/** 扩展健康状态：healthy=已注册，degraded=缺失但已降级，unknown=未检测 */
export type ExtensionHealthStatus = 'healthy' | 'degraded' | 'unknown'

/** 关键扩展 ID —— 与 SDK initializeManagerExtensions 注册的访问器名对应 */
export const CRITICAL_EXTENSION_IDS = ['friend-manager'] as const
export type CriticalExtensionId = (typeof CRITICAL_EXTENSION_IDS)[number]

export const useCapabilityStore = defineStore(StoresEnum.CAPABILITY, () => {
  const unstableFeatures = ref<Record<string, boolean>>({})
  const capabilities = ref<Record<string, unknown>>({})
  const clientConfig = ref<Record<string, unknown>>({})
  const isLoaded = ref(false)

  // 扩展健康状态：由 assertCriticalExtensions 在 client 创建后写入。
  // 与服务端 capabilities 分离——服务端能力表示"服务端支持"，
  // extensionHealth 表示"客户端 SDK 扩展已注册"。两者都为 true 才表示功能完全可用。
  const extensionHealth = ref<Record<string, ExtensionHealthStatus>>({})

  function setCapabilities(data: Partial<MatrixCapabilities>) {
    if (data.unstable_features) unstableFeatures.value = data.unstable_features
    if (data.capabilities) capabilities.value = data.capabilities
    if (data.client_config) clientConfig.value = data.client_config
    isLoaded.value = true
  }

  /** 设置扩展健康状态（由 assertCriticalExtensions 调用） */
  function setExtensionHealth(id: string, status: ExtensionHealthStatus) {
    extensionHealth.value[id] = status
  }

  /** 批量设置扩展健康状态 */
  function setExtensionHealthBatch(statuses: Record<string, ExtensionHealthStatus>) {
    extensionHealth.value = { ...extensionHealth.value, ...statuses }
  }

  /** 重置扩展健康状态（logout / client 重建时调用） */
  function resetExtensionHealth() {
    extensionHealth.value = {}
  }

  const isCapabilityEnabled = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value
    if (value && typeof value === 'object' && 'enabled' in value) {
      return (value as { enabled?: unknown }).enabled === true
    }
    return false
  }

  const hasUnstable = (flag: string) => computed(() => unstableFeatures.value[flag] === true)

  const hasFeature = (feature: string) =>
    computed(() => {
      // 检查 capabilities 或 client_config 中的特性
      return isCapabilityEnabled(capabilities.value[feature]) || isCapabilityEnabled(clientConfig.value[feature])
    })

  /** 扩展是否健康（已注册） */
  const isExtensionHealthy = (id: string) => computed(() => extensionHealth.value[id] === 'healthy')

  /** 是否有任一关键扩展处于降级状态 */
  const hasDegradedExtension = computed(() => Object.values(extensionHealth.value).some((s) => s === 'degraded'))

  return {
    unstableFeatures,
    capabilities,
    clientConfig,
    isLoaded,
    extensionHealth,
    hasDegradedExtension,
    setCapabilities,
    setExtensionHealth,
    setExtensionHealthBatch,
    resetExtensionHealth,
    hasUnstable,
    hasFeature,
    isExtensionHealthy
  }
})
