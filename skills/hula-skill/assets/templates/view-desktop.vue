<template>
  <section class="size-full p-16px">
    <n-flex vertical :size="12">
      <n-page-header :title="title" :subtitle="description">
        <template #extra>
          <n-button type="primary" @click="handleAction">
            {{ t('common.action') }}
          </n-button>
        </template>
      </n-page-header>

      <n-spin :show="loading">
        <n-empty v-if="!items.length" :description="t('common.empty')" />
        <n-list v-else>
          <n-list-item v-for="item in items" :key="item.id">
            <ItemCard :item="item" @click="handleItemClick(item)" />
          </n-list-item>
        </n-list>
      </n-spin>
    </n-flex>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useExampleStore } from '@/stores/example'
import type { ExampleItem } from '@/types'

defineOptions({
  name: 'ExampleDesktopView'
})

const { t } = useI18n()
const store = useExampleStore()
const { items, loading } = storeToRefs(store)

const title = computed(() => t('example.title'))
const description = computed(() => t('example.description'))

function handleAction(): void {
  store.fetchItems()
}

function handleItemClick(_item: ExampleItem): void {}

onMounted(() => {
  store.fetchItems()
})
</script>

<style scoped></style>
