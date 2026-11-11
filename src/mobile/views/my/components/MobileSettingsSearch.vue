<template>
  <div class="settings-search-results">
    <van-cell-group v-if="results.length > 0" inset>
      <van-cell
        v-for="item in results"
        :key="item.labelKey + (item.path ?? item.anchor ?? '')"
        :title="t(item.labelKey)"
        :label="t(item.groupKey)"
        is-link
        @click="emit('navigate', item)">
        <template #icon>
          <SettingCellIcon icon="mdi:magnify" color="var(--tjg-color-info-500)" shell="info" />
        </template>
      </van-cell>
    </van-cell-group>

    <van-empty v-else :description="t('setting.dialog.nav_empty')">
      <div class="text-12px text-[--tjg-text-tertiary] px-24px text-center">
        {{ t('setting.dialog.nav_empty_desc') }}
      </div>
    </van-empty>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import {
  MOBILE_SETTINGS_SEARCH_ENTRIES,
  type MobileSettingsSearchEntry
} from '@/mobile/views/my/mobileSettingsSearchIndex'

const props = defineProps<{ query: string }>()
const emit = defineEmits<(e: 'navigate', item: MobileSettingsSearchEntry) => void>()

const { t } = useI18n()

/**
 * 匹配规则：条目译文 / 分组译文 / 关键词，任一「包含」即命中（不区分大小写）。
 *
 * 不做前缀匹配（中文没有词边界，前缀会把「设备」搜不到「管理设备」）；
 * 也不引入拼音（收益有限、体积不小）。
 */
const results = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (!q) return []
  return MOBILE_SETTINGS_SEARCH_ENTRIES.filter((entry) => {
    const label = t(entry.labelKey).toLowerCase()
    const group = t(entry.groupKey).toLowerCase()
    return label.includes(q) || group.includes(q) || entry.keywords.some((k) => k.toLowerCase().includes(q))
  })
})
</script>

<style scoped lang="scss">
.settings-search-results {
  padding-bottom: var(--tjg-space-4);
}

:deep(.van-cell) {
  background: var(--tjg-surface-panel);
}

:deep(.van-cell::after) {
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-cell:last-child::after) {
  border-bottom: none;
}
</style>
