import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { MatrixCapabilities } from '@/types/message'

export const useCapabilityStore = defineStore(StoresEnum.CAPABILITY, () => {
  const unstableFeatures = ref<Record<string, boolean>>({})
  const capabilities = ref<Record<string, unknown>>({})
  const clientConfig = ref<Record<string, unknown>>({})
  const isLoaded = ref(false)

  function setCapabilities(data: Partial<MatrixCapabilities>) {
    if (data.unstable_features) unstableFeatures.value = data.unstable_features
    if (data.capabilities) capabilities.value = data.capabilities
    if (data.client_config) clientConfig.value = data.client_config
    isLoaded.value = true
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

  return {
    unstableFeatures,
    capabilities,
    clientConfig,
    isLoaded,
    setCapabilities,
    hasUnstable,
    hasFeature
  }
})
