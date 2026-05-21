<template>
  <main class="openclaw-workbench__messages" role="log" aria-live="polite" aria-label="Chat messages">
    <!-- Search bar -->
    <div v-if="isSearchOpen" class="openclaw-workbench__search-bar">
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        class="openclaw-workbench__search-input"
        :placeholder="ctx.translate('common.search')"
        @input="onSearchInput" />
      <span v-if="searchQuery" class="openclaw-workbench__search-count">
        {{ searchMatches.length === 0 ? '0' : `${currentMatchIndex + 1}` }}/{{ searchMatches.length }}
      </span>
      <button
        type="button"
        class="openclaw-workbench__search-nav-btn"
        :disabled="searchMatches.length === 0"
        :title="ctx.translate('ai_assistant.robot.search_prev')"
        :aria-label="ctx.translate('ai_assistant.robot.search_prev')"
        @click="navigateMatch(-1)">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button
        type="button"
        class="openclaw-workbench__search-nav-btn"
        :disabled="searchMatches.length === 0"
        :title="ctx.translate('ai_assistant.robot.search_next')"
        :aria-label="ctx.translate('ai_assistant.robot.search_next')"
        @click="navigateMatch(1)">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button
        type="button"
        class="openclaw-workbench__search-close-btn"
        :title="ctx.translate('common.close')"
        :aria-label="ctx.translate('common.close')"
        @click="closeSearch">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <OpenClawWelcomeScreen v-if="!ctx.currentConversation || ctx.currentConversation.messages.length === 0" />

    <DynamicScroller
      v-else
      ref="scrollerRef"
      class="openclaw-workbench__scroller"
      :items="ctx.currentConversation.messages"
      :min-item-size="80"
      :buffer="20"
      key-field="id">
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :size-dependencies="[item.content, item.reasoningContent, item.status]"
          :data-index="index">
          <div class="openclaw-workbench__message-item">
            <OpenClawChatMessage
              :message="item"
              :search-query="searchQuery"
              :is-current-match="currentMatch?.messageId === item.id" />
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DynamicScroller } from 'vue-virtual-scroller'
import type { SearchMatch } from '../composables/useOpenClawContext'
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scrollerRef = ref<
  (InstanceType<typeof DynamicScroller> & { scrollToItem: (index: number) => void; scrollToBottom: () => void }) | null
>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Search state
const isSearchOpen = ref(false)
const searchQuery = ref('')
const searchMatches = ref<SearchMatch[]>([])
const currentMatchIndex = ref(-1)

const currentMatch = computed(() =>
  currentMatchIndex.value >= 0 && currentMatchIndex.value < searchMatches.value.length
    ? searchMatches.value[currentMatchIndex.value]
    : null
)

// Compute search matches
const computeSearchMatches = () => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query || !ctx.currentConversation) {
    searchMatches.value = []
    currentMatchIndex.value = -1
    return
  }

  const matches: SearchMatch[] = []
  ctx.currentConversation.messages.forEach((msg, index) => {
    if (msg.content.toLowerCase().includes(query)) {
      matches.push({ messageId: msg.id, messageIndex: index })
    }
  })
  searchMatches.value = matches

  if (matches.length > 0) {
    currentMatchIndex.value = 0
    scrollToMatch(matches[0])
  } else {
    currentMatchIndex.value = -1
  }
}

const onSearchInput = () => {
  computeSearchMatches()
}

const navigateMatch = (direction: number) => {
  if (searchMatches.value.length === 0) return
  let newIndex = currentMatchIndex.value + direction
  if (newIndex < 0) newIndex = searchMatches.value.length - 1
  if (newIndex >= searchMatches.value.length) newIndex = 0
  currentMatchIndex.value = newIndex
  scrollToMatch(searchMatches.value[newIndex])
}

const scrollToMatch = (match: SearchMatch) => {
  nextTick(() => {
    scrollerRef.value?.scrollToItem(match.messageIndex)
  })
}

const openSearch = () => {
  isSearchOpen.value = true
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

const closeSearch = () => {
  isSearchOpen.value = false
  searchQuery.value = ''
  searchMatches.value = []
  currentMatchIndex.value = -1
}

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  const isMod = e.metaKey || e.ctrlKey
  if (isMod && e.key === 'f') {
    e.preventDefault()
    if (isSearchOpen.value) {
      searchInputRef.value?.focus()
      searchInputRef.value?.select()
    } else {
      openSearch()
    }
  }
  if (e.key === 'Escape' && isSearchOpen.value) {
    e.preventDefault()
    closeSearch()
  }
  if (isSearchOpen.value && e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) {
      navigateMatch(-1)
    } else {
      navigateMatch(1)
    }
  }
}

// Reset search when conversation changes
watch(
  () => ctx.currentConversation?.id,
  () => {
    if (isSearchOpen.value) {
      computeSearchMatches()
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  scrollToBottom: () => {
    scrollerRef.value?.scrollToBottom()
  },
  openSearch
})
</script>

<style scoped>
.openclaw-workbench__messages {
  flex: 1;
  min-height: 0;
  padding: 0 4px;
  display: flex;
  flex-direction: column;
}

.openclaw-workbench__scroller {
  flex: 1;
  min-height: 0;
}

.openclaw-workbench__message-item {
  padding: 16px 0;
}

.openclaw-workbench__search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin: 4px 4px 0;
  background: var(--center-bg-color);
  border: 1px solid var(--line-color);
  border-radius: 8px;
  flex-shrink: 0;
}

.openclaw-workbench__search-input {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-color);
  font-size: 13px;
  line-height: 1.4;
}

.openclaw-workbench__search-input::placeholder {
  color: var(--color-text-tertiary);
}

.openclaw-workbench__search-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  padding: 0 4px;
  user-select: none;
}

.openclaw-workbench__search-nav-btn,
.openclaw-workbench__search-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--color-text-tertiary);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.openclaw-workbench__search-nav-btn:hover:not(:disabled),
.openclaw-workbench__search-close-btn:hover {
  color: var(--text-color);
  background: var(--bg-msg-hover);
}

.openclaw-workbench__search-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
