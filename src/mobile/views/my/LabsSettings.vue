<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_labs.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--hula-text-secondary)] mb-8px">{{ t('mobile_labs.description') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.integrations')"
              :label="t('mobile_integrations.description')"
              is-link
              @click="openIntegrationsSettings">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:puzzle" :width="20" color="var(--hula-color-warning-500)" />
                </div>
              </template>
              <template #value>
                <van-tag type="warning" size="medium">Beta</van-tag>
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group inset>
            <van-cell
              v-for="feature in labFeatures"
              :key="feature.id"
              :title="feature.name"
              :label="feature.description">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon :icon="feature.icon || 'mdi:flask'" :width="20" color="var(--hula-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <div class="flex items-center gap-8px">
                  <van-tag v-if="feature.status === 'beta'" type="warning" size="medium">Beta</van-tag>
                  <van-tag v-else-if="feature.status === 'alpha'" type="danger" size="medium">Alpha</van-tag>
                  <van-tag v-else size="medium">{{ t('mobile_labs.experimental') }}</van-tag>
                  <van-switch v-model="feature.enabled" size="20" @change="handleToggleFeature(feature)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="featureWarning" class="px-16px py-12px bg-[var(--hula-color-warning-100)] rounded-lg">
            <div class="flex items-center gap-8px text-[var(--hula-color-warning-500)] text-13px">
              <Icon icon="mdi:alert-circle" :width="16" />
              <span>{{ featureWarning }}</span>
            </div>
          </div>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_labs.developer_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_labs.debug_mode')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-bg-secondary)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bug" :width="20" color="var(--hula-text-secondary)" />
                </div>
              </template>
              <template #label>
                <span class="text-12px text-[var(--hula-text-quaternary)]">{{ t('mobile_labs.debug_mode_desc') }}</span>
              </template>
              <template #right-icon>
                <van-switch v-model="debugMode" @change="handleDebugModeChange" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_labs.show_performance')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:speedometer" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
              <template #label>
                <span class="text-12px text-[var(--hula-text-quaternary)]">
                  {{ t('mobile_labs.show_performance_desc') }}
                </span>
              </template>
              <template #right-icon>
                <van-switch v-model="showPerformanceMetrics" @change="handlePerformanceChange" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px px-16px">
            <van-button type="warning" block plain @click="handleResetLabs">
              {{ t('mobile_labs.reset') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { createLogger } from '@/utils/Logger'
import { MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH } from './settingsRoutes'

const logger = createLogger('LabsSettings')

const { t } = useI18n()
const router = useRouter()

interface LabFeature {
  id: string
  name: string
  description: string
  status: 'alpha' | 'beta' | 'experimental'
  enabled: boolean
  icon?: string
  warning?: string
}

const debugMode = ref(false)
const showPerformanceMetrics = ref(false)

const labFeatures = ref<LabFeature[]>([
  {
    id: 'threads',
    name: t('mobile_labs.features.threads'),
    description: t('mobile_labs.features.threads_desc'),
    status: 'beta',
    enabled: false,
    icon: 'mdi:message-text'
  },
  {
    id: 'spaces',
    name: t('mobile_labs.features.spaces'),
    description: t('mobile_labs.features.spaces_desc'),
    status: 'beta',
    enabled: false,
    icon: 'mdi:folder-multiple'
  },
  {
    id: 'voip',
    name: t('mobile_labs.features.voip'),
    description: t('mobile_labs.features.voip_desc'),
    status: 'alpha',
    enabled: false,
    icon: 'mdi:phone',
    warning: t('mobile_labs.features.voip_warning')
  },
  {
    id: 'widget',
    name: t('mobile_labs.features.widget'),
    description: t('mobile_labs.features.widget_desc'),
    status: 'experimental',
    enabled: false,
    icon: 'mdi:widget'
  },
  {
    id: 'custom-status',
    name: t('mobile_labs.features.custom_status'),
    description: t('mobile_labs.features.custom_status_desc'),
    status: 'beta',
    enabled: true,
    icon: 'mdi:emoticon'
  },
  {
    id: 'message-editing',
    name: t('mobile_labs.features.message_editing'),
    description: t('mobile_labs.features.message_editing_desc'),
    status: 'beta',
    enabled: false,
    icon: 'mdi:pencil'
  },
  {
    id: 'reactions',
    name: t('mobile_labs.features.reactions'),
    description: t('mobile_labs.features.reactions_desc'),
    status: 'beta',
    enabled: true,
    icon: 'mdi:emoticon-happy'
  },
  {
    id: 'read-receipts',
    name: t('mobile_labs.features.read_receipts'),
    description: t('mobile_labs.features.read_receipts_desc'),
    status: 'experimental',
    enabled: false,
    icon: 'mdi:check-all'
  }
])

const featureWarning = computed(() => {
  const enabledWithWarning = labFeatures.value.find((f) => f.enabled && f.warning)
  return enabledWithWarning?.warning || ''
})

onMounted(() => {
  loadSavedSettings()
})

function loadSavedSettings() {
  const savedFeatures = localStorage.getItem('hula-lab-features')
  if (savedFeatures) {
    try {
      const enabledIds = JSON.parse(savedFeatures) as string[]
      labFeatures.value.forEach((feature) => {
        feature.enabled = enabledIds.includes(feature.id)
      })
    } catch (e) {
      logger.error('Failed to parse saved lab features')
    }
  }

  const savedDebug = localStorage.getItem('hula-debug-mode')
  if (savedDebug) debugMode.value = savedDebug === 'true'

  const savedPerformance = localStorage.getItem('hula-show-performance')
  if (savedPerformance) showPerformanceMetrics.value = savedPerformance === 'true'
}

function saveFeatures() {
  const enabledIds = labFeatures.value.filter((f) => f.enabled).map((f) => f.id)
  localStorage.setItem('hula-lab-features', JSON.stringify(enabledIds))
}

function handleToggleFeature(feature: LabFeature) {
  saveFeatures()

  showToast({
    type: 'success',
    message: feature.enabled
      ? t('mobile_labs.feature_enabled', { name: feature.name })
      : t('mobile_labs.feature_disabled', { name: feature.name })
  })
}

function handleDebugModeChange(value: boolean) {
  localStorage.setItem('hula-debug-mode', value.toString())
  showToast({
    type: 'success',
    message: value ? t('mobile_labs.debug_enabled') : t('mobile_labs.debug_disabled')
  })
}

function handlePerformanceChange(value: boolean) {
  localStorage.setItem('hula-show-performance', value.toString())
  showToast({
    type: 'success',
    message: value ? t('mobile_labs.performance_enabled') : t('mobile_labs.performance_disabled')
  })
}

function openIntegrationsSettings() {
  router.push(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
}

async function handleResetLabs() {
  try {
    await showConfirmDialog({
      title: t('mobile_labs.reset_confirm.title'),
      message: t('mobile_labs.reset_confirm.message'),
      confirmButtonText: t('mobile_labs.reset_confirm.confirm'),
      cancelButtonText: t('mobile_labs.reset_confirm.cancel')
    })

    labFeatures.value.forEach((feature) => {
      feature.enabled = ['custom-status', 'reactions'].includes(feature.id)
    })
    saveFeatures()

    showToast({
      type: 'success',
      message: t('mobile_labs.reset_success')
    })
  } catch {
    // User cancelled
  }
}
</script>

<style scoped></style>
