<template>
  <div ref="containerRef" class="smart-virtual-list" @scroll.passive="handleScroll">
    <div v-if="showTopTip && !loading" class="top-tip">
      <span>{{ topTipText }}</span>
    </div>

    <div v-if="loading && items.length === 0" class="loading-wrapper">
      <van-loading size="24px" />
    </div>

    <div v-else>
      <div ref="phantomRef" class="phantom"></div>
      <div ref="contentRef" class="content-wrapper" :style="{ transform: `translateY(${offset}px)` }">
        <div
          v-for="item in visibleItems"
          :key="getKey(item)"
          :data-id="getId(item)"
          :data-index="item._index"
          class="virtual-item">
          <slot :item="item" :index="item._index"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { id?: string | number; [key: string]: any }">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

type ListItem = { id?: string | number; [key: string]: unknown }

type VisibleItem<TItem extends ListItem> = TItem & {
  _index: number
}

const props = withDefaults(
  defineProps<{
    items: T[]
    itemHeight?: number
    buffer?: number
    loading?: boolean
    showTopTip?: boolean
    topTipText?: string
    keyField?: string
  }>(),
  {
    items: () => [],
    itemHeight: 50,
    buffer: 5,
    loading: false,
    showTopTip: false,
    topTipText: '没有更多数据了',
    keyField: 'id'
  }
)

const emit = defineEmits<{
  loadMore: []
  scroll: [event: Event]
}>()

const containerRef = ref<HTMLElement | null>(null)
const phantomRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const scrollTop = ref(0)
const offset = ref(0)
const itemHeights = ref<Map<string | number, number>>(new Map())

const BUFFER = props.buffer
const ITEM_HEIGHT = props.itemHeight

const totalHeight = computed(() => {
  if (props.items.length === 0) return 0

  return props.items.reduce((total, item) => {
    const id = getId(item)
    return total + (itemHeights.value.get(id) || ITEM_HEIGHT)
  }, 0)
})

const visibleCount = computed(() => {
  if (!containerRef.value) return 20

  const containerHeight = containerRef.value.clientHeight
  return Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER * 2
})

const startIndex = computed(() => {
  if (props.items.length === 0) return 0

  let height = 0
  let index = 0

  for (let i = 0; i < props.items.length; i++) {
    const id = getId(props.items[i])
    height += itemHeights.value.get(id) || ITEM_HEIGHT

    if (height > scrollTop.value - BUFFER * ITEM_HEIGHT) {
      index = i
      break
    }
  }

  return Math.max(0, index)
})

const endIndex = computed(() => {
  return Math.min(props.items.length - 1, startIndex.value + visibleCount.value)
})

const visibleItems = computed<VisibleItem<T>[]>(() => {
  return props.items.slice(startIndex.value, endIndex.value + 1).map((item, idx) => ({
    ...item,
    _index: startIndex.value + idx
  }))
})

function getKey(item: T): string | number {
  return item[props.keyField] ?? item.id ?? JSON.stringify(item)
}

function getId(item: T): string | number {
  return item[props.keyField] ?? item.id ?? JSON.stringify(item)
}

function calculateOffset(): number {
  let height = 0

  for (let i = 0; i < startIndex.value; i++) {
    const id = getId(props.items[i])
    height += itemHeights.value.get(id) || ITEM_HEIGHT
  }

  return height
}

function updateItemHeights(): void {
  if (!contentRef.value) return

  const children = contentRef.value.children

  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement
    const id = child.dataset.id
    const index = parseInt(child.dataset.index || '0', 10)

    if (id && index >= startIndex.value && index <= endIndex.value) {
      const height = child.getBoundingClientRect().height
      itemHeights.value.set(id, height)
    }
  }
}

function handleScroll(event: Event): void {
  if (!containerRef.value) return

  scrollTop.value = containerRef.value.scrollTop
  offset.value = calculateOffset()

  emit('scroll', event)

  if (scrollTop.value < 50 && !props.loading && props.items.length > 0) {
    emit('loadMore')
  }

  nextTick(() => {
    updateItemHeights()
  })
}

function scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
  if (!containerRef.value) return

  let targetTop = 0

  for (let i = 0; i < index && i < props.items.length; i++) {
    const id = getId(props.items[i])
    targetTop += itemHeights.value.get(id) || ITEM_HEIGHT
  }

  containerRef.value.scrollTo({
    top: targetTop,
    behavior
  })
}

function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
  if (!containerRef.value) return

  containerRef.value.scrollTo({
    top: totalHeight.value,
    behavior
  })
}

function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
  if (!containerRef.value) return

  containerRef.value.scrollTo({
    top: 0,
    behavior
  })
}

watch(
  () => totalHeight.value,
  (height) => {
    if (phantomRef.value) {
      phantomRef.value.style.height = `${height}px`
    }
  }
)

watch(
  () => props.items.length,
  () => {
    nextTick(() => {
      updateItemHeights()
    })
  }
)

onMounted(() => {
  if (phantomRef.value) {
    phantomRef.value.style.height = `${totalHeight.value}px`
  }
})

onUnmounted(() => {
  itemHeights.value.clear()
})

defineExpose({
  scrollToIndex,
  scrollToBottom,
  scrollToTop,
  getContainer: () => containerRef.value
})
</script>

<style scoped>
.smart-virtual-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}

.content-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  will-change: transform;
}

.virtual-item {
  width: 100%;
}

.top-tip {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  color: var(--hula-text-tertiary, #909090);
  font-size: 12px;
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
