<template>
  <section class="space-invite-bar" data-testid="space-invite-bar">
    <!-- 搜索框 -->
    <div class="space-invite-bar__search">
      <svg
        class="space-invite-bar__search-icon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        v-model="query"
        type="text"
        class="space-invite-bar__input"
        :placeholder="t('space.invite_search_placeholder')"
        :disabled="directoryUnavailable"
        :aria-label="t('space.invite_search_placeholder')"
        @input="onInput" />
      <span v-if="searching" class="space-invite-bar__searching">{{ t('space.invite_searching') }}</span>
    </div>

    <!-- 目录不可用提示 -->
    <p v-if="directoryUnavailable" class="space-invite-bar__hint">{{ t('space.invite_directory_unavailable') }}</p>

    <!-- 搜索结果下拉 -->
    <div v-if="showResults" class="space-invite-bar__results" data-testid="space-invite-results">
      <template v-if="results.length">
        <button
          v-for="user in results"
          :key="user.userId"
          type="button"
          class="space-invite-bar__item"
          :class="{ 'space-invite-bar__item--disabled': isProcessed(user.userId) }"
          :disabled="isProcessed(user.userId) || invitingId === user.userId"
          :aria-label="user.displayName || user.userId"
          @click="handleInvite(user.userId)">
          <span class="space-invite-bar__avatar">
            <img v-if="user.avatarUrl" :src="user.avatarUrl" :alt="''" class="space-invite-bar__avatar-img" />
            <span v-else>{{ getInitials(user.userId) }}</span>
          </span>
          <span class="space-invite-bar__info">
            <span class="space-invite-bar__name">{{ user.displayName || user.userId }}</span>
            <span class="space-invite-bar__uid">{{ user.userId }}</span>
          </span>
          <span v-if="isSelf(user.userId)" class="space-invite-bar__tag">{{ t('space.invite_self_tag') }}</span>
          <span v-else-if="isMember(user.userId)" class="space-invite-bar__tag">
            {{ t('space.invite_already_member') }}
          </span>
          <span v-else-if="isInvited(user.userId)" class="space-invite-bar__tag">
            {{ t('space.invite_pending_tag') }}
          </span>
          <span v-else-if="invitingId === user.userId" class="space-invite-bar__tag">
            {{ t('space.invite_inviting') }}
          </span>
        </button>
      </template>
      <p v-else-if="!searching" class="space-invite-bar__empty">{{ t('space.invite_search_empty') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceMembers } from '@/composables/space/useSpaceMembers'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { type UserDirectorySearchResult, userDirectoryService } from '@/services/matrix/user/MatrixUserDirectoryService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpaceInviteBar')

const props = defineProps<{
  /** 当前空间 ID */
  spaceId: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { members, invite } = useSpaceMembers(() => props.spaceId)

const query = ref('')
const results = ref<UserDirectorySearchResult[]>([])
const showResults = ref(false)
const searching = ref(false)
const invitingId = ref<string | null>(null)
const directoryUnavailable = ref(false)

const DEBOUNCE_MS = 300
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 当前用户自身的 userId
const selfId = computed(() => matrixClientService.getClient()?.getUserId() ?? '')

// userId -> membership 映射，用于标记已加入/已邀请
const memberMap = computed(() => {
  const map = new Map<string, string>()
  for (const m of members.value) {
    map.set(m.user_id, m.membership ?? '')
  }
  return map
})

const isSelf = (userId: string) => userId === selfId.value
const isMember = (userId: string) => memberMap.value.get(userId) === 'join'
const isInvited = (userId: string) => memberMap.value.get(userId) === 'invite'
const isProcessed = (userId: string) => isSelf(userId) || isMember(userId) || isInvited(userId)

const getInitials = (text: string) => {
  const localPart = text.startsWith('@') ? text.slice(1).split(':')[0] : text
  return localPart.slice(0, 2).toUpperCase() || '?'
}

const doSearch = async () => {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    showResults.value = false
    return
  }
  searching.value = true
  try {
    const res = await userDirectoryService.searchUsers(q, 20)
    results.value = res
    showResults.value = true
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.warn('user directory search failed', errMsg)
    // 目录不可用（404/网络/服务端未实现）时禁用搜索框
    if (
      errMsg.includes('404') ||
      errMsg.toLowerCase().includes('not found') ||
      errMsg.toLowerCase().includes('directory')
    ) {
      directoryUnavailable.value = true
    }
    results.value = []
  } finally {
    searching.value = false
  }
}

const onInput = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void doSearch()
  }, DEBOUNCE_MS)
}

const handleInvite = async (userId: string) => {
  if (isProcessed(userId) || invitingId.value) return
  invitingId.value = userId
  try {
    const ok = await invite(userId)
    if (ok) {
      showFeedback(t('space.invite_success'), 'success')
      // 邀请成功后从结果中移除，避免重复展示
      results.value = results.value.filter((r) => r.userId !== userId)
    } else {
      showFeedback(t('space.invite_failed'), 'error')
    }
  } catch {
    showFeedback(t('space.invite_failed'), 'error')
  } finally {
    invitingId.value = null
  }
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped lang="scss">
.space-invite-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--tjg-border-layout-divider);
  flex-shrink: 0;
}

.space-invite-bar__search {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.space-invite-bar__search-icon {
  position: absolute;
  left: 12px;
  color: var(--tjg-text-quaternary);
  pointer-events: none;
}

.space-invite-bar__input {
  flex: 1;
  height: 36px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 8px;
  background: var(--tjg-surface-search);
  color: var(--tjg-text-primary);
  font-size: 13px;

  &:focus {
    border-color: var(--tjg-color-primary-500);
    outline: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.space-invite-bar__searching {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  white-space: nowrap;
}

.space-invite-bar__hint {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.space-invite-bar__results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--tjg-border-default);
  border-radius: 8px;
  background: var(--tjg-surface-panel);
}

.space-invite-bar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tjg-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;

  &:hover:not(.space-invite-bar__item--disabled) {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: -2px;
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.space-invite-bar__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--tjg-surface-search);
  color: var(--tjg-text-secondary);
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
}

.space-invite-bar__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.space-invite-bar__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.space-invite-bar__name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-invite-bar__uid {
  font-size: 11px;
  color: var(--tjg-text-quaternary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-invite-bar__tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--tjg-surface-search);
}

.space-invite-bar__empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--tjg-text-quaternary);
}
</style>
