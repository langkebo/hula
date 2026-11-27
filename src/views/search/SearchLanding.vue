<template>
  <!--
    全局搜索的落地页。

    搜索本身在右侧栏（`layout/right` 的 SearchPane），路由 `/search` 只负责把右栏切到
    `search` 视图（见 `useRightView.ts` 的 `if (path === '/search') return 'search'`）。
    中间栏此前复用 FriendsList，于是 `Ctrl+Shift+F` 后左侧显示完整好友列表、
    右侧才是搜索框，看起来像"搜到了好友页"。

    这里改成一句引导，把注意力交给右侧搜索框。
  -->
  <div class="search-landing">
    <EmptyState icon="mdi:magnify" :title="t('search.title')" :description="t('search.empty_hint')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'

const { t } = useI18n()
</script>

<style scoped>
.search-landing {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
