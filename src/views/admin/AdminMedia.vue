<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MediaLibraryPanel from '@/components/admin/media/MediaLibraryPanel.vue'
import MediaQuarantineChangesPanel from '@/components/admin/media/MediaQuarantineChangesPanel.vue'
import MediaScopedPanel from '@/components/admin/media/MediaScopedPanel.vue'

type MediaTab = 'library' | 'scoped' | 'quarantine'

const { t } = useI18n()
const activeTab = ref<MediaTab>('library')
</script>

<template>
  <n-page-header :title="t('admin.media.title')" :subtitle="t('admin.media.description')" />
  <n-tabs v-model:value="activeTab" type="line" animated>
    <n-tab-pane name="library" :tab="t('admin.media.tab.library')">
      <media-library-panel />
    </n-tab-pane>
    <n-tab-pane name="scoped" :tab="t('admin.media.tab.scoped')">
      <media-scoped-panel />
    </n-tab-pane>
    <n-tab-pane name="quarantine" :tab="t('admin.media.tab.quarantine')">
      <media-quarantine-changes-panel />
    </n-tab-pane>
  </n-tabs>
</template>
