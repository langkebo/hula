<template>
  <PermissionGuard :require="'burn-after-read'">
    <div class="flex-shrink-0 px-12px py-4px flex items-center gap-8px border-t border-[--tjg-border-default]">
      <BurnAfterReadToggle
        :enabled="enabled"
        @update:enabled="$emit('update:enabled', $event)"
        @select-duration="$emit('select-duration', $event)" />
      <span class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">
        {{ enabled ? t('editor.burn_after_read_enabled') : t('editor.burn_after_read_disabled') }}
      </span>
    </div>
  </PermissionGuard>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BurnAfterReadToggle from '@/components/burn/BurnAfterReadToggle.vue'
import PermissionGuard from '@/components/common/PermissionGuard.vue'

/**
 * 私密模式下输入框上方的「阅后即焚」切换条。
 *
 * 从 `ChatMain.vue` 抽出（该文件 646 行基线、不得增长）。抽出后宿主只留
 * `<BurnAfterReadBar v-if="privateModeActive" ... />` 一行。
 *
 * ⚠️ 服务端不支持该能力时 `PermissionGuard` 直接不渲染 —— 展示一个必定失败的
 * 开关比不展示更糟。
 */
defineOptions({ name: 'BurnAfterReadBar' })

defineProps<{ enabled: boolean }>()
defineEmits<{ 'update:enabled': [boolean]; 'select-duration': [number] }>()

const { t } = useI18n()
</script>
