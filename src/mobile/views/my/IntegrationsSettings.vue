<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_integrations.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="flex items-start gap-8px p-12px bg-[var(--tjg-color-warning-100)] rounded-8px">
            <svg class="w-16px h-16px flex-shrink-0 mt-2px color-[--tjg-color-warning-500]" aria-hidden="true">
              <use href="#caution" />
            </svg>
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
                  <svg class="w-20px h-20px color-[--tjg-text-tertiary]" aria-hidden="true">
                    <use href="#plugins" />
                  </svg>
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped></style>
