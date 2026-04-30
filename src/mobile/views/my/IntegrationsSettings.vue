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
                <van-switch :model-value="integrationsEnabled" @update:model-value="handleIntegrationsToggle" />
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
                  <van-switch
                    :model-value="integration.enabled"
                    size="20"
                    @update:model-value="(value) => handleToggleIntegration(integration, value)" />
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
                  <van-switch
                    :model-value="permissions.userInfo"
                    @update:model-value="(value) => handlePermissionChange('userInfo', value)" />
                </template>
              </van-cell>

              <van-cell :title="t('mobile_integrations.permission_room_list')">
                <template #right-icon>
                  <van-switch
                    :model-value="permissions.roomList"
                    @update:model-value="(value) => handlePermissionChange('roomList', value)" />
                </template>
              </van-cell>

              <van-cell :title="t('mobile_integrations.permission_send_message')">
                <template #right-icon>
                  <van-switch
                    :model-value="permissions.sendMessage"
                    @update:model-value="(value) => handlePermissionChange('sendMessage', value)" />
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
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import {
  createDefaultIntegrationsCatalog,
  type Integration,
  type IntegrationCatalogItem,
  type IntegrationPermissions,
  useIntegrations
} from '@/composables/useIntegrations'

const { t } = useI18n()

const {
  integrationsEnabled,
  integrations,
  availableIntegrations,
  permissions,
  setIntegrationsEnabled,
  setIntegrationEnabled,
  installIntegration,
  setPermission
} = useIntegrations(createDefaultIntegrationsCatalog({ translate: t }))

function handleIntegrationsToggle(value: boolean) {
  setIntegrationsEnabled(value)
  showToast({
    type: 'success',
    message: value ? t('mobile_integrations.enabled_success') : t('mobile_integrations.disabled_success')
  })
}

function handleToggleIntegration(integration: Integration, value: boolean) {
  setIntegrationEnabled(integration.id, value)
  showToast({
    type: 'success',
    message: value
      ? t('mobile_integrations.integration_enabled', { name: integration.name })
      : t('mobile_integrations.integration_disabled', { name: integration.name })
  })
}

async function handleInstallIntegration(integration: IntegrationCatalogItem) {
  showToast({
    type: 'loading',
    message: t('mobile_integrations.installing', { name: integration.name }),
    duration: 1000
  })

  const installed = await installIntegration(integration.id, 1000)
  if (installed) {
    showToast({
      type: 'success',
      message: t('mobile_integrations.install_success', { name: integration.name })
    })
  }
}

function handlePermissionChange(key: keyof IntegrationPermissions, value: boolean) {
  setPermission(key, value)
}
</script>

<style scoped></style>
