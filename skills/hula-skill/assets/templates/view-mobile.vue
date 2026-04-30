<template>
  <section class="min-h-100vh p-16px bg-[--bg-color]">
    <van-nav-bar :title="title" left-arrow @click-left="onBack" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list v-model:loading="loading" :finished="finished" :finished-text="t('common.noMore')" @load="onLoad">
        <van-empty v-if="!items.length && !loading" :description="t('common.empty')" />

        <van-cell-group v-else inset class="mt-12px">
          <van-cell
            v-for="item in items"
            :key="item.id"
            :title="item.name"
            :label="item.description"
            is-link
            @click="handleItemClick(item)" />
        </van-cell-group>
      </van-list>
    </van-pull-refresh>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useExampleStore } from '#/stores/example'
import type { ExampleItem } from '#/types'

defineOptions({
  name: 'ExampleMobileView'
})

const { t } = useI18n()
const router = useRouter()
const store = useExampleStore()
const { items, loading } = storeToRefs(store)

const title = computed(() => t('example.title'))
const refreshing = ref(false)
const finished = ref(false)

function onBack(): void {
  router.back()
}

async function onRefresh(): Promise<void> {
  refreshing.value = true
  await store.fetchItems()
  refreshing.value = false
}

async function onLoad(): Promise<void> {
  await store.fetchMore()
  finished.value = !store.hasMore
}

function handleItemClick(item: ExampleItem): void {
  router.push({ name: 'ExampleDetail', params: { id: item.id } })
}

onMounted(() => {
  store.fetchItems()
})
</script>

<style scoped></style>
