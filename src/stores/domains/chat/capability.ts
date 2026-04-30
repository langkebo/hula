import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'

export interface MatrixCapabilities {
  unstable_features: Record<string, boolean>
  capabilities: Record<string, unknown>
  client_config: Record<string, unknown>
}

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

  const hasUnstable = (flag: string) => computed(() => !!unstableFeatures.value[flag])

  const hasFeature = (feature: string) =>
    computed(() => {
      // 检查 capabilities 或 client_config 中的特性
      return !!capabilities.value[feature] || !!clientConfig.value[feature]
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
