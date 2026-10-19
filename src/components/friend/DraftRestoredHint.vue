<template>
  <div class="add-friend-pane__hint" role="status" aria-live="polite">
    <svg class="size-14px"><use href="#info"></use></svg>
    <span>{{ t('common.draft_restored') }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 「已恢复草稿」提示条。
 *
 * 从 `AddFriendPane.vue` 抽出：该文件已超过 800 行红线，`check:file-size`
 * 对基线内文件是零容忍增长 —— 任何新增都要以「搬走等量代码」为代价，
 * 而不是把基线往上调。
 */
defineOptions({ name: 'DraftRestoredHint' })

const { t } = useI18n()
</script>
