<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_integrations.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="flex items-start gap-8px p-12px bg-amber-50 rounded-8px mb-4px">
            <Icon icon="mdi:alert-circle-outline" :width="16" color="#d48806" class="flex-shrink-0 mt-2px" />
            <span class="text-12px text-amber-700">{{ t('mobile_integrations.beta_warning') }}</span>
          </div>

          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_integrations.description') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_integrations.enable_integrations')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:puzzle" :width="20" color="#722ed1" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="integrationsEnabled" @change="handleIntegrationsToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <template v-if="integrationsEnabled">
            <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_integrations.installed_section') }}</div>

            <van-cell-group inset>
              <van-cell
                v-for="integration in integrations"
                :key="integration.id"
                :title="integration.name"
                :label="integration.description">
                <template #icon>
                  <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                    <Icon :icon="integration.icon || 'mdi:puzzle'" :width="20" color="#666" />
                  </div>
                </template>
                <template #value>
                  <div class="flex items-center gap-8px">
                    <span class="text-12px text-gray-400">v{{ integration.version }}</span>
                    <van-tag :type="integration.enabled ? 'success' : 'default'" size="medium">
                      {{ integration.enabled ? t('mobile_integrations.enabled') : t('mobile_integrations.disabled') }}
                    </van-tag>
                  </div>
                </template>
                <template #right-icon>
                  <van-switch v-model="integration.enabled" size="20" @change="handleToggleIntegration(integration)" />
                </template>
              </van-cell>
            </van-cell-group>

            <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_integrations.available_section') }}</div>

            <van-cell-group inset>
              <van-cell
                v-for="integration in availableIntegrations"
                :key="integration.id"
                :title="integration.name"
                :label="integration.description">
                <template #icon>
                  <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                    <Icon :icon="integration.icon || 'mdi:puzzle'" :width="20" color="#1989fa" />
                  </div>
                </template>
                <template #right-icon>
                  <van-button size="small" type="primary" @click="handleInstallIntegration(integration)">
                    {{ t('mobile_integrations.install') }}
                  </van-button>
                </template>
              </van-cell>
            </van-cell-group>

            <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_integrations.permissions_section') }}</div>

            <van-cell-group inset>
              <van-cell :title="t('mobile_integrations.permission_user_info')">
                <template #right-icon>
                  <van-switch v-model="permissions.userInfo" @change="handlePermissionChange" />
                </template>
              </van-cell>

              <van-cell :title="t('mobile_integrations.permission_room_list')">
                <template #right-icon>
                  <van-switch v-model="permissions.roomList" @change="handlePermissionChange" />
                </template>
              </van-cell>

              <van-cell :title="t('mobile_integrations.permission_send_message')">
                <template #right-icon>
                  <van-switch v-model="permissions.sendMessage" @change="handlePermissionChange" />
                </template>
              </van-cell>
            </van-cell-group>
          </template>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('IntegrationsSettings')
const timerManager = useTimerManager()

const { t } = useI18n()

interface Integration {
  id: string
  name: string
  description: string
  version: string
  icon?: string
  enabled: boolean
}

const integrationsEnabled = ref(true)

const integrations = ref<Integration[]>([
  {
    id: 'github',
    name: 'GitHub',
    description: t('mobile_integrations.integration_github'),
    version: '1.2.0',
    icon: 'mdi:github',
    enabled: true
  },
  {
    id: 'giphy',
    name: 'Giphy',
    description: t('mobile_integrations.integration_giphy'),
    version: '2.0.1',
    icon: 'mdi:gif',
    enabled: false
  }
])

const availableIntegrations = ref<Integration[]>([
  {
    id: 'jira',
    name: 'Jira',
    description: t('mobile_integrations.integration_jira'),
    version: '1.0.0',
    icon: 'mdi:jira',
    enabled: false
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: t('mobile_integrations.integration_calendar'),
    version: '1.1.0',
    icon: 'mdi:calendar',
    enabled: false
  }
])

const permissions = ref({
  userInfo: true,
  roomList: false,
  sendMessage: false
})

onMounted(() => {
  loadSavedSettings()
})

function loadSavedSettings() {
  const savedEnabled = localStorage.getItem('hula-integrations-enabled')
  if (savedEnabled) integrationsEnabled.value = savedEnabled === 'true'

  const savedPermissions = localStorage.getItem('hula-integrations-permissions')
  if (savedPermissions) {
    try {
      permissions.value = JSON.parse(savedPermissions)
    } catch (e) {
      logger.error('Failed to parse saved permissions')
    }
  }
}

function handleIntegrationsToggle(value: boolean) {
  localStorage.setItem('hula-integrations-enabled', value.toString())
  showToast({
    type: 'success',
    message: value ? t('mobile_integrations.enabled_success') : t('mobile_integrations.disabled_success')
  })
}

function handleToggleIntegration(integration: Integration) {
  showToast({
    type: 'success',
    message: integration.enabled
      ? t('mobile_integrations.integration_enabled', { name: integration.name })
      : t('mobile_integrations.integration_disabled', { name: integration.name })
  })
}

function handleInstallIntegration(integration: Integration) {
  showToast({
    type: 'loading',
    message: t('mobile_integrations.installing', { name: integration.name }),
    duration: 1000
  })

  timerManager.setTimeout(() => {
    integrations.value.push({
      ...integration,
      enabled: true
    })
    availableIntegrations.value = availableIntegrations.value.filter((i) => i.id !== integration.id)

    showToast({
      type: 'success',
      message: t('mobile_integrations.install_success', { name: integration.name })
    })
  }, 1000)
}

function handlePermissionChange() {
  localStorage.setItem('hula-integrations-permissions', JSON.stringify(permissions.value))
}
</script>

<style scoped></style>
