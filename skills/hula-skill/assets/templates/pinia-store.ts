// biome-ignore-all lint/suspicious/noConsole: Template code intentionally includes simple console-based examples.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixExampleService } from '@/services/matrix'
import type { ExampleItem } from '@/types'

export const useExampleStore = defineStore(StoresEnum.EXAMPLE, () => {
  const items = ref<ExampleItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasMore = ref(true)
  const currentPage = ref(0)
  const pageSize = 20

  const isEmpty = computed(() => items.value.length === 0)
  const itemCount = computed(() => items.value.length)

  async function fetchItems(): Promise<void> {
    loading.value = true
    error.value = null
    currentPage.value = 0

    try {
      const result = await matrixExampleService.getItems({
        limit: pageSize,
        offset: 0
      })
      items.value = result.items
      hasMore.value = result.hasMore
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('[ExampleStore] Failed to fetch items:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchMore(): Promise<void> {
    if (loading.value || !hasMore.value) return

    loading.value = true
    currentPage.value++

    try {
      const result = await matrixExampleService.getItems({
        limit: pageSize,
        offset: currentPage.value * pageSize
      })
      items.value.push(...result.items)
      hasMore.value = result.hasMore
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      currentPage.value--
      console.error('[ExampleStore] Failed to fetch more items:', e)
    } finally {
      loading.value = false
    }
  }

  async function addItem(item: Omit<ExampleItem, 'id'>): Promise<ExampleItem | null> {
    loading.value = true
    error.value = null

    try {
      const newItem = await matrixExampleService.createItem(item)
      items.value.unshift(newItem)
      return newItem
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('[ExampleStore] Failed to add item:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateItem(id: string, updates: Partial<ExampleItem>): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const updated = await matrixExampleService.updateItem(id, updates)
      const index = items.value.findIndex((item) => item.id === id)
      if (index !== -1) {
        items.value[index] = updated
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('[ExampleStore] Failed to update item:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteItem(id: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      await matrixExampleService.deleteItem(id)
      items.value = items.value.filter((item) => item.id !== id)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('[ExampleStore] Failed to delete item:', e)
      return false
    } finally {
      loading.value = false
    }
  }

  function getItemById(id: string): ExampleItem | undefined {
    return items.value.find((item) => item.id === id)
  }

  function clearItems(): void {
    items.value = []
    error.value = null
    currentPage.value = 0
    hasMore.value = true
  }

  return {
    items,
    loading,
    error,
    hasMore,
    isEmpty,
    itemCount,
    fetchItems,
    fetchMore,
    addItem,
    updateItem,
    deleteItem,
    getItemById,
    clearItems
  }
})
