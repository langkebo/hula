<template>
  <n-scrollbar
    ref="panelScrollbarRef"
    style="max-height: 290px"
    :class="[isMobileRef ? 'h-15rem w-auto' : 'h-290px w-460px', isSeriesView ? 'emoji-panel-series' : '']"
    class="p-[14px_14px_0_14px] box-border select-none"
    :size="isSeriesView ? 0 : undefined"
    :trigger="isSeriesView ? 'none' : undefined"
    @scroll="handlePanelScroll">
    <transition name="fade" mode="out-in">
      <div :key="activeIndex" class="emoji-content">
        <!-- 最近使用 -->
        <div v-if="activeIndex === 0">
          <div v-if="emojiRef.historyList?.length > 0">
            <span v-if="!checkIsUrl(emojiRef.historyList[0])" class="text-12px text-[--tjg-text-primary]">
              {{ t('emoticon.recent.title') }}
            </span>
            <n-flex align="center" :class="isMobileRef ? 'emoji-grid-mobile mt-12px mb-12px' : 'mt-12px mb-12px'">
              <n-flex
                align="center"
                justify="center"
                class="emoji-item"
                v-for="(item, index) in [...new Set(emojiRef.historyList)].filter((emoji) => !checkIsUrl(emoji))"
                :key="index"
                @click.stop="chooseEmoji(item)">
                {{ item }}
              </n-flex>
            </n-flex>
          </div>

          <!-- emoji表情 -->
          <div v-for="items in emojiObj" :key="items?.name">
            <template v-if="items?.name && items.value?.length">
              <span class="text-12px text-[--tjg-text-primary]">{{ items.name }}</span>
              <n-flex align="center" :class="isMobileRef ? 'emoji-grid-mobile my-12px' : 'my-12px'">
                <n-flex
                  align="center"
                  justify="center"
                  class="emoji-item"
                  v-for="(item, index) in items.value"
                  :key="index"
                  @click.stop="chooseEmoji(item)">
                  {{ item }}
                </n-flex>
              </n-flex>
            </template>
          </div>
        </div>

        <!-- 表情包系列 -->
        <div v-else-if="currentSeries" class="series-virtual-wrapper">
          <span class="text-12px text-[--tjg-text-primary] pl-12px">{{ currentSeries.name }}</span>
          <div class="series-virtual-container mt-12px">
            <n-virtual-list
              ref="seriesVirtualListRef"
              :items="displaySeriesRows"
              :item-size="seriesRowHeight"
              :style="{ height: seriesViewportHeight }"
              class="series-virtual-list"
              @scroll="handleSeriesScroll">
              <template #default="{ item }">
                <div
                  class="emoji-pack-row"
                  :style="{
                    gridTemplateColumns: `repeat(${packColumns}, 1fr)`,
                    gap: isMobileRef ? '8px' : '12px'
                  }">
                  <div
                    class="emoji-item emoji-item--image"
                    v-for="(emojiItem, index) in item.emojis"
                    :key="index"
                    @click.stop="
                      chooseEmoji(
                        {
                          renderUrl: emojiItem.url,
                          serverUrl: emojiItem.url
                        },
                        'url'
                      )
                    ">
                    <img
                      :alt="emojiItem.name"
                      :title="emojiItem.name"
                      :src="emojiItem.url"
                      loading="lazy"
                      decoding="async"
                      class="emoji-image size-full object-contain rounded-8px transition duration-300 ease-in-out transform-gpu" />
                  </div>
                </div>
              </template>
            </n-virtual-list>
          </div>
        </div>

        <!-- 我的喜欢页面 -->
        <div v-else>
          <div v-if="emojiStore.emojiList?.length > 0">
            <span class="text-12px text-[--tjg-text-primary]">{{ t('emoticon.favorites.title') }}</span>
            <n-flex align="center" :class="isMobileRef ? 'emoji-pack-grid-mobile mx-6px my-12px' : 'mx-6px my-12px'">
              <n-flex
                align="center"
                justify="center"
                class="emoji-item emoji-item--image py-4px"
                v-for="(item, index) in displayFavoriteEmojis"
                :key="index"
                @click.stop="
                  chooseEmoji(
                    {
                      id: item.id,
                      renderUrl: getEmojiRenderUrl(item),
                      serverUrl: item.expressionUrl
                    },
                    'url'
                  )
                ">
                <n-popover
                  trigger="manual"
                  :show="activeMenuId === item.id"
                  :duration="300"
                  :show-arrow="false"
                  placement="top"
                  @clickoutside="activeMenuId = ''">
                  <template #trigger>
                    <div
                      class="emoji-visibility-wrapper size-full"
                      :ref="(el: Element | ComponentPublicInstance | null) => registerEmojiVisibilityTarget(el, item)">
                      <n-image
                        width="60"
                        height="60"
                        preview-disabled
                        :src="getEmojiRenderUrl(item)"
                        @contextmenu.prevent="handleContextMenu($event, item)"
                        class="emoji-image size-full object-contain rounded-8px transition duration-300 ease-in-out transform-gpu" />
                    </div>
                  </template>
                  <n-button quaternary size="tiny" @click.stop="deleteMyEmoji(item.id)">
                    {{ t('emoticon.favorites.delete') }}
                    <template #icon>
                      <n-icon>
                        <svg><use href="#delete"></use></svg>
                      </n-icon>
                    </template>
                  </n-button>
                </n-popover>
              </n-flex>
            </n-flex>
          </div>
          <span v-else>{{ t('emoticon.favorites.empty') }}</span>
        </div>
      </div>
    </transition>
  </n-scrollbar>

  <!-- 底部选项 -->
  <n-flex align="center" class="expression-item">
    <n-scrollbar x-scrollable class="scrollbar-container">
      <div class="series-container">
        <template v-for="item in tabList" :key="item.id">
          <!-- 图标类型选项 -->
          <svg
            class="series-icon"
            v-if="item.type === 'icon'"
            :class="{ active: activeIndex === item.id }"
            @click="handleTabChange(item.id)">
            <use :href="item.icon"></use>
          </svg>

          <!-- 系列类型选项 -->
          <div
            v-else
            :class="{ active: activeIndex === item.id }"
            @click="selectSeries(item.id - 1)"
            class="series-icon">
            <img :title="item.name" :src="item.cover" :alt="item.name" class="w-full h-full object-contain" />
          </div>
        </template>
      </div>
    </n-scrollbar>
  </n-flex>
</template>

<script setup lang="ts">
import type { HulaEmojiData } from 'hula-emojis'
import type { ScrollbarInst, VirtualListInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { EmojiItem as EmojiListItem } from '@/services/types'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useHistoryStore } from '@/stores/domains/chat/history'
import { useUserStore } from '@/stores/domains/user/user'
import { getAllTypeEmojis } from '@/utils/Emoji.ts'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { useEmojiLocalCache } from './useEmojiLocalCache'
import { useEmojiPagination } from './useEmojiPagination'

const logger = createLogger('Emoticon')

const isMobileRef = computed(() => isMobile())

type TabItem = {
  id: number
  type: 'icon' | 'series'
  name: string
  icon?: string
  cover?: string
}

interface EmojiGroupItem {
  name: string
  value: string[]
}

type EmojiType = {
  expressionEmojis: EmojiGroupItem
  animalEmojis: EmojiGroupItem
  gestureEmojis: EmojiGroupItem
}

type EmojiUrlPayload = {
  id?: string
  renderUrl: string
  serverUrl: string
  expressionUrl?: string
}

type EmojiSelection = string | EmojiUrlPayload

const emit = defineEmits<{
  emojiHandle: [item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url']
}>()
const props = defineProps<{
  all: boolean
}>()
const { emoji, lastEmojiTabIndex } = storeToRefs(useHistoryStore())
const { setEmoji, setLastEmojiTabIndex } = useHistoryStore()
const emojiStore = useEmojiStore()
const userStore = useUserStore()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const emojisBbs = shallowRef<HulaEmojiData>()
const activeIndex = ref(lastEmojiTabIndex.value)
const isFavoritesView = computed(() => activeIndex.value === -1)
const isSeriesView = computed(() => activeIndex.value > 0)
const seriesVirtualListRef = ref<VirtualListInst | null>(null)
const panelScrollbarRef = ref<ScrollbarInst | null>(null)
const activeMenuId = ref('')

const tabList = computed<TabItem[]>(() => {
  const baseItems: TabItem[] = [
    { id: 0, type: 'icon', name: t('emoticon.tabs.emoji'), icon: '#face' },
    { id: -1, type: 'icon', name: t('emoticon.tabs.favorites'), icon: '#heart' }
  ]
  if (!emojisBbs.value) return baseItems
  const seriesItems: TabItem[] = emojisBbs.value.series.map((series, index) => ({
    id: index + 1,
    type: 'series',
    name: series.name,
    cover: series.cover
  }))
  return [...baseItems, ...seriesItems]
})

const currentSeries = computed(() =>
  activeIndex.value > 0 && emojisBbs.value ? emojisBbs.value.series[activeIndex.value - 1] : null
)

const reversedEmojiList = computed(() => [...emojiStore.emojiList].reverse())

const {
  favoritesPage,
  seriesPage,
  favoritesPageSize,
  packColumns,
  seriesRowHeight,
  seriesViewportHeight,
  SERIES_PAGE_SIZE,
  onPanelScroll,
  onSeriesScroll,
  resetFavoritesPage,
  resetSeriesPage
} = useEmojiPagination({
  isFavoritesView,
  reversedEmojiList,
  currentSeries,
  getSeriesEmojis: (series) => series.emojis
})

const displayFavoriteEmojis = computed(() => {
  const size = favoritesPage.value * favoritesPageSize.value
  return reversedEmojiList.value.slice(0, size)
})

const displaySeriesRows = computed(() => {
  if (!currentSeries.value) return []
  const cols = packColumns.value
  const size = seriesPage.value * SERIES_PAGE_SIZE
  const visibleEmojiCount = Math.min(currentSeries.value.emojis.length, size)
  const rows: { key: number; emojis: (typeof currentSeries.value.emojis)[number][] }[] = []
  for (let i = 0; i < visibleEmojiCount; i += cols) {
    rows.push({ key: i, emojis: currentSeries.value.emojis.slice(i, i + cols) })
  }
  return rows
})

const handlePanelScroll = (event: Event) => {
  activeMenuId.value = ''
  const target =
    (panelScrollbarRef.value as { containerRef?: HTMLElement } | null)?.containerRef ||
    (event.target as HTMLElement | null) ||
    (event.currentTarget as HTMLElement | null)
  onPanelScroll(target ?? null)
}

const handleSeriesScroll = (event?: Event) => {
  const target =
    (event?.target as HTMLElement | null) ||
    (event?.currentTarget as HTMLElement | null) ||
    (seriesVirtualListRef.value as { listElRef?: HTMLElement } | null)?.listElRef ||
    null
  onSeriesScroll(target)
}

const res = getAllTypeEmojis()

const emojiObj = ref<EmojiType>(
  props.all
    ? res
    : ({
        expressionEmojis: res.expressionEmojis,
        animalEmojis: res.animalEmojis,
        gestureEmojis: res.gestureEmojis
      } as EmojiType)
)

const emojiRef = reactive<{
  chooseItem: string
  historyList: string[]
  allEmoji: EmojiType
}>({
  chooseItem: '',
  historyList: emoji.value,
  allEmoji: emojiObj.value
})

const {
  getEmojiRenderUrl,
  resolveCachedRenderUrl,
  registerEmojiVisibilityTarget,
  hydrateEmojiLocalCache,
  scheduleHydrateFavorites,
  cleanupAllEmojiCaches,
  disconnectEmojiObserver,
  terminateWorker,
  emojiUrlToLocalMap,
  localUrlCache
} = useEmojiLocalCache({ isFavoritesView, emojiStore, userStore })

const checkIsUrl = (str: string) => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

const handleContextMenu = (event: MouseEvent, item: EmojiListItem) => {
  event.preventDefault()
  activeMenuId.value = item.id
}

const deleteMyEmoji = async (id: string) => {
  try {
    await emojiStore.deleteEmoji(id)
    showFeedback(t('emoticon.favorites.deleteSuccess'), 'success')
    activeMenuId.value = ''
    localUrlCache.clear()
    emojiUrlToLocalMap.clear()
  } catch (error) {
    logger.error('删除表情失败:', error)
    showFeedback(t('emoticon.favorites.deleteFail'), 'error')
  }
}

const chooseEmoji = async (item: EmojiSelection, type: 'emoji' | 'url' = 'emoji') => {
  emojiRef.chooseItem = typeof item === 'string' ? item : item?.renderUrl || item?.expressionUrl || ''

  if (type === 'emoji' && typeof item === 'string') {
    const index = emojiRef.historyList.indexOf(item)
    if (index !== -1) {
      emojiRef.historyList.splice(index, 1)
    }
    emojiRef.historyList.unshift(item)
    if (emojiRef.historyList.length > 18) {
      emojiRef.historyList.splice(18)
    }
    setEmoji([...emojiRef.historyList])
  }

  if (type === 'url') {
    const payload =
      typeof item === 'object' && item
        ? {
            id: item.id,
            renderUrl: item.renderUrl || item.expressionUrl || '',
            serverUrl: item.serverUrl || item.expressionUrl || ''
          }
        : { renderUrl: typeof item === 'string' ? item : '', serverUrl: typeof item === 'string' ? item : '' }
    if (!isFavoritesView.value) {
      emit('emojiHandle', payload, 'emoji-url')
      return payload
    }
    const cached = resolveCachedRenderUrl(payload.id, payload.serverUrl || payload.renderUrl)
    if (cached) {
      payload.renderUrl = cached
    }
    emit('emojiHandle', payload, 'emoji-url')
    return payload
  }

  emit('emojiHandle', item, 'emoji')
  return item
}

const handleTabChange = (index: number) => {
  activeIndex.value = index
  if (index === -1) resetFavoritesPage()
  if (index > 0) resetSeriesPage()
  void nextTick().then(() => {
    panelScrollbarRef.value?.scrollTo({ top: 0 })
  })
  if (index !== -1) {
    cleanupAllEmojiCaches()
    disconnectEmojiObserver()
    terminateWorker()
  } else {
    void hydrateEmojiLocalCache()
  }
  setLastEmojiTabIndex(index)
}

const selectSeries = (index: number) => {
  handleTabChange(index + 1)
}

onMounted(async () => {
  const { default: HulaEmojis } = await import('hula-emojis')
  emojisBbs.value = HulaEmojis.MihoyoBbs
  await emojiStore.getEmojiList()
  scheduleHydrateFavorites()
})

onBeforeUnmount(() => {
  disconnectEmojiObserver()
  terminateWorker()
  cleanupAllEmojiCaches()
})
</script>

<style lang="scss">
/**! 修改naive-ui滚动条的间距 */
.n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--vertical,
.n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--vertical {
  right: 0;
}

.n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--horizontal > .n-scrollbar-rail__scrollbar,
.n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--horizontal > .n-scrollbar-rail__scrollbar {
  top: 4px;
}

.emoji-item {
  @apply cursor-pointer;
  @apply size-36px text-26px hover:bg-[--tjg-menu-hover] rounded-8px;
}

.emoji-item--image {
  @apply size-60px hover:bg-transparent;

  &:hover .emoji-image {
    @apply scale-116 bg-[--tjg-menu-hover] rounded-8px;
  }
}

.emoji-visibility-wrapper {
  @apply w-full h-full;
}

.expression-item {
  @apply h-50px w-full p-[0_14px] box-border select-none;
  border-top: 1px solid var(--tjg-border-default);

  .scrollbar-container {
    @apply w-full max-w-420px;
    overflow-x: auto;
  }

  .series-container {
    @apply flex items-center;
    white-space: nowrap;
    width: max-content;

    svg {
      @apply size-26px my-4px p-6px rounded-8px mr-12px flex-shrink-0 inline-flex items-center justify-center;
      &:not(.active):hover {
        background-color: var(--tjg-menu-hover);
        cursor: pointer;
      }
    }
  }

  .series-icon {
    @apply size-30px my-4px p-4px rounded-8px mr-12px flex-shrink-0 inline-flex items-center justify-center;
    &:not(.active):hover {
      background-color: var(--tjg-menu-hover);
      cursor: pointer;
    }

    &.active {
      background-color: var(--tjg-color-primary-500) !important;
    }

    &:last-child {
      margin-right: 0;
    }
  }
}

.emoji-content {
  position: relative;
  width: 100%;
}

.emoji-pack-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding: 6px 12px;
  min-height: 72px;
}

.series-virtual-container {
  width: 100%;
  margin: 0;
  padding: 6px 0 0 0;
}

.emoji-panel-series > .n-scrollbar-rail.n-scrollbar-rail--vertical {
  // 仅隐藏外层滚动条，不影响内层虚拟列表
  display: none !important;
}

.emoji-panel-series {
  padding: 14px 0 0 0 !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: all var(--tjg-motion-duration-overlay) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

// 移动端表情网格布局 - 普通emoji表情（7列）
.emoji-grid-mobile {
  display: grid !important;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  justify-items: center;
  width: 100%;
}

// 移动端表情包网格布局 - 表情包图片（4列）
.emoji-pack-grid-mobile {
  display: grid !important;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  justify-items: center;
  width: 100%;
}
</style>
