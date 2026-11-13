<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_integrations.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="flex items-start gap-8px p-12px bg-[var(--tjg-color-warning-100)] rounded-8px">
            <Icon
              icon="mdi:alert-circle-outline"
              :width="16"
              color="var(--tjg-color-warning-500)"
              class="flex-shrink-0 mt-2px" />
            <span class="text-12px text-[var(--tjg-color-warning-500)]">
              {{ t('mobile_integrations.unavailable_description') }}
            </span>
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_integrations.unavailable_title')"
              :label="t('mobile_integrations.description')"
              disabled
              data-testid="integrations-unavailable">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-surface-panel-muted)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:puzzle-outline" :width="20" color="var(--tjg-text-tertiary)" />
                </div>
              </template>
              <template #value>
                <van-tag type="default" size="medium">
                  {{ t('mobile_integrations.unavailable_badge') }}
                </van-tag>
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

const { t } = useI18n()
</script>

<style scoped></style>
