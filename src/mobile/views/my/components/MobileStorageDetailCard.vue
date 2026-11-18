<template>
  <!-- 明细：哪些数据占了多少。此前只有总量，用户无法判断「能不能清」 -->
  <van-cell-group :title="t('mobile_storage.detail_section')" inset>
    <van-cell
      :title="t('mobile_storage.search_index')"
      :value="searchIndexText"
      :label="t('mobile_storage.search_index_desc')"
      data-testid="search-index-cell" />
    <van-cell
      :title="t('mobile_storage.local_storage')"
      :value="formatBytes(localBytes)"
      :label="t('mobile_storage.local_storage_keys', { count: localKeyCount })"
      data-testid="local-storage-cell" />
    <van-cell
      :title="t('mobile_storage.thumbnail_cache')"
      :value="mediaCacheTextFor('thumbnails')"
      :label="t('mobile_storage.thumbnail_cache_desc')"
      data-testid="thumbnail-cache-cell" />
    <van-cell
      :title="t('mobile_storage.emoji_cache')"
      :value="mediaCacheTextFor('emojis')"
      :label="t('mobile_storage.emoji_cache_desc')"
      data-testid="emoji-cache-cell" />
    <van-cell
      :title="t('mobile_storage.other_data')"
      :label="t('mobile_storage.other_data_desc')"
      data-testid="other-data-cell" />
  </van-cell-group>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/Formatting'

defineProps<{
  searchIndexText: string
  localBytes: number
  localKeyCount: number
  mediaCacheTextFor: (kind: 'thumbnails' | 'emojis') => string
}>()

const { t } = useI18n()
</script>
