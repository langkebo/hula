<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_labs.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">{{ t('mobile_labs.description') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.integrations')"
              :label="t('mobile_integrations.description')"
              is-link
              @click="openIntegrationsSettings">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:puzzle" :width="20" color="var(--tjg-color-warning-500)" />
                </div>
              </template>
              <template #value>
                <van-tag type="warning" size="medium">Beta</van-tag>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH } from './settingsRoutes'

const { t } = useI18n()
const router = useRouter()

function openIntegrationsSettings() {
  router.push(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
}
</script>

<style scoped></style>
