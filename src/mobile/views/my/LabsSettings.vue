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
              :clickable="false"
              disabled
              data-testid="integrations-entry">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                    <use href="#plugins" />
                  </svg>
                </div>
              </template>
              <template #value>
                <van-tag type="default" size="medium">{{ t('mobile_integrations.unavailable_badge') }}</van-tag>
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
