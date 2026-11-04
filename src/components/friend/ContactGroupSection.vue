<template>
  <section class="contact-group-section" :class="{ 'contact-group-section--collapsed': collapsed }">
    <button
      type="button"
      data-test="group-header"
      class="contact-group-section__header"
      :aria-expanded="!collapsed"
      :aria-label="groupName"
      @click="$emit('toggle')">
      <svg
        data-test="group-arrow"
        class="contact-group-section__arrow"
        :class="{ 'contact-group-section__arrow--collapsed': collapsed }"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true">
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
      <span data-test="group-name" class="contact-group-section__name">{{ groupName }}</span>
      <span data-test="group-count" class="contact-group-section__count">{{ friends.length }}</span>
    </button>

    <div v-show="!collapsed" class="contact-group-section__body" role="list">
      <FriendListItem
        v-for="friend in visibleFriends"
        :key="friend.userId"
        :item="friend"
        :selected="friend.userId === selectedUserId"
        :query="query"
        @select="$emit('select-friend', $event)"
        @send-message="$emit('send-message', $event)"
        @remove="$emit('remove', $event)"
        @more="$emit('more', $event)"
        @contextmenu="$emit('contextmenu', $event)" />

      <!-- 与扁平列表同一门控（> 100 才需要窗口化）：分组模式下此前是裸 v-for，
           成员多的分组会一次性渲染整组。这里不引虚拟列表 —— 区段在页面滚动容器内，
           再套一层 RecycleScroller 会变成嵌套滚动。 -->
      <button
        v-if="hasMore"
        type="button"
        class="contact-group-section__more"
        data-test="group-show-more"
        @click="showMore">
        {{ t('friend.list.show_more', { count: friends.length - visibleFriends.length }) }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import FriendListItem from './FriendListItem.vue'

/** 与 FriendListView 的 `VIRTUAL_SCROLL_THRESHOLD` 对齐：> 100 才需要窗口化 */
const GROUP_WINDOW_SIZE = 100

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    groupName: string
    friends: MatrixContact[]
    collapsed: boolean
    selectedUserId?: string
    query?: string
  }>(),
  {
    selectedUserId: '',
    query: ''
  }
)

/**
 * 可见窗口：分组超过 100 位时只渲染前 100，点「显示更多」再追加 100。
 * 判据与扁平列表一致，避免「扁平有门控、分组没有」的不一致。
 */
const visibleCount = ref(GROUP_WINDOW_SIZE)
const visibleFriends = computed(() =>
  props.friends.length > GROUP_WINDOW_SIZE ? props.friends.slice(0, visibleCount.value) : props.friends
)
const hasMore = computed(() => props.friends.length > visibleFriends.value.length)

const showMore = () => {
  visibleCount.value += GROUP_WINDOW_SIZE
}

// 分组数据换了（切筛选 / 搜索 / 换分组）就重置窗口，避免停在旧的展开位置
watch(
  () => props.friends,
  () => {
    visibleCount.value = GROUP_WINDOW_SIZE
  }
)

defineEmits<{
  toggle: []
  'select-friend': [item: MatrixContact]
  'send-message': [item: MatrixContact]
  remove: [item: MatrixContact]
  more: [payload: { item: MatrixContact; event: MouseEvent }]
  contextmenu: [payload: { item: MatrixContact; event: MouseEvent }]
}>()
</script>

<style scoped lang="scss">
.contact-group-section {
  display: flex;
  flex-direction: column;
}

.contact-group-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm, 12px);
  width: 100%;
  text-align: left;
  border-radius: var(--tjg-radius-xs, 4px);
  transition: background-color var(--tjg-motion-duration-fast, 120ms) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.contact-group-section__arrow {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  transition: transform var(--tjg-motion-duration-normal, 180ms) var(--tjg-motion-ease-standard);
}

.contact-group-section__arrow--collapsed {
  transform: rotate(-90deg);
}

.contact-group-section__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-group-section__count {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm, 12px);
}

.contact-group-section__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

/* 分组超过 100 位时的「显示更多」入口 */
.contact-group-section__more {
  margin: 4px 8px 8px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--tjg-radius-xs, 4px);
  background: transparent;
  color: var(--tjg-color-primary-500);
  font-size: var(--tjg-font-size-sm, 12px);
  cursor: pointer;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-group-section__header,
  .contact-group-section__arrow {
    transition: none;
  }
}
</style>
