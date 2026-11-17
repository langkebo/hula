<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    class="psd w-[640px]"
    :title="t('space.discover.title')"
    :bordered="false"
    data-testid="public-space-discovery">
    <div class="psd__body" :aria-busy="loading">
      <form class="psd__search" @submit.prevent="handleSearch">
        <n-input
          v-model:value="keyword"
          data-testid="psd-keyword"
          clearable
          :placeholder="t('space.discover.search_placeholder')"
          :disabled="loading" />
        <n-button type="primary" attr-type="submit" data-testid="psd-search" :loading="loading" :disabled="loading">
          {{ t('space.discover.search') }}
        </n-button>
      </form>

      <p v-if="errorMessage" class="psd__error" role="alert" data-testid="psd-error">{{ errorMessage }}</p>

      <div v-if="loading" class="psd__state" data-testid="psd-loading">
        <n-spin size="small" />
        <span>{{ t('space.discover.loading') }}</span>
      </div>

      <EmptyState
        v-else-if="results.length === 0"
        compact
        variant="subtle"
        data-testid="psd-empty"
        :description="t('space.no_results')" />

      <ul v-else class="psd__list">
        <li v-for="space in results" :key="space.spaceId" class="psd__item" data-testid="psd-item">
          <div class="psd__row">
            <img
              class="psd__avatar"
              :src="avatarOf(space)"
              alt=""
              width="40"
              height="40"
              loading="lazy"
              decoding="async" />
            <div class="psd__info">
              <p class="psd__name" data-testid="psd-name">{{ space.name || space.spaceId }}</p>
              <p class="psd__meta">{{ t('space.member_count_value', { count: space.memberCount }) }}</p>
              <p v-if="space.topic" class="psd__topic">{{ space.topic }}</p>
            </div>
            <div class="psd__actions">
              <n-button
                size="small"
                data-testid="psd-browse"
                :loading="hierarchyLoadingId === space.spaceId"
                @click="toggleHierarchy(space)">
                {{ hierarchyId === space.spaceId ? t('space.collapse') : t('space.view_hierarchy') }}
              </n-button>
              <n-button
                size="small"
                type="primary"
                data-testid="psd-join"
                :loading="joiningId === space.spaceId"
                :disabled="isJoinPending(space.spaceId)"
                @click="handleJoin(space)">
                {{ joinLabel(space) }}
              </n-button>
            </div>
          </div>

          <div v-if="hierarchyId === space.spaceId" class="psd__children" data-testid="psd-children">
            <p v-if="hierarchyLoadingId === space.spaceId" class="psd__state">
              {{ t('space.discover.loading') }}
            </p>
            <EmptyState
              v-else-if="childSpaces.length === 0"
              compact
              variant="subtle"
              data-testid="psd-children-empty"
              :description="t('space.discover.children_empty')" />
            <ul v-else class="psd__child-list">
              <li v-for="child in childSpaces" :key="child.spaceId" class="psd__child" data-testid="psd-child">
                <img
                  class="psd__avatar psd__avatar--child"
                  :src="avatarOf(child)"
                  alt=""
                  width="28"
                  height="28"
                  loading="lazy"
                  decoding="async" />
                <div class="psd__info">
                  <p class="psd__name">{{ child.name || child.spaceId }}</p>
                  <p class="psd__meta">{{ t('space.member_count_value', { count: child.memberCount }) }}</p>
                </div>
                <n-button
                  size="tiny"
                  type="primary"
                  data-testid="psd-child-join"
                  :loading="joiningId === child.spaceId"
                  :disabled="isJoinPending(child.spaceId)"
                  @click="handleJoin(child)">
                  {{ joinLabel(child) }}
                </n-button>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NModal, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixSpaceService, type SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  /** 弹窗可见性（v-model:show） */
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [boolean]
  joined: [spaceId: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const keyword = ref('')
const results = ref<SpaceInfo[]>([])
const loading = ref(false)
const errorMessage = ref('')
const joiningId = ref('')
const joinedIds = ref<string[]>([])
const requestedIds = ref<string[]>([])
const hierarchyId = ref('')
const hierarchyLoadingId = ref('')
const childSpaces = ref<SpaceInfo[]>([])

let requestSeq = 0

const avatarOf = (space: SpaceInfo) => AvatarUtils.getAvatarUrl(space.avatarUrl, 40)

const isJoinPending = (spaceId: string) => joinedIds.value.includes(spaceId) || requestedIds.value.includes(spaceId)

const joinLabel = (space: SpaceInfo) => {
  if (joinedIds.value.includes(space.spaceId)) return t('space.membership_join')
  if (requestedIds.value.includes(space.spaceId)) return t('space.knock_success')
  if (space.joinRule === 'knock') return t('space.request_to_join')
  return t('space.join')
}

const toChildSpace = (room: Record<string, unknown>): SpaceInfo | null => {
  if (room.room_type !== 'm.space') return null
  const spaceId = typeof room.room_id === 'string' ? room.room_id : ''
  if (!spaceId) return null
  return {
    spaceId,
    name: typeof room.name === 'string' && room.name ? room.name : spaceId,
    topic: typeof room.topic === 'string' ? room.topic : undefined,
    avatarUrl: typeof room.avatar_url === 'string' ? room.avatar_url : undefined,
    memberCount: typeof room.num_joined_members === 'number' ? room.num_joined_members : 0,
    childCount: Array.isArray(room.children_state) ? room.children_state.length : 0
  }
}

const loadSpaces = async (query: string) => {
  const seq = ++requestSeq
  loading.value = true
  errorMessage.value = ''
  hierarchyId.value = ''
  childSpaces.value = []
  try {
    const list = query
      ? await matrixSpaceService.searchSpaces(query, 20, { throwOnError: true })
      : await matrixSpaceService.getPublicSpaces(50, { throwOnError: true })
    if (seq !== requestSeq) return
    results.value = list
  } catch {
    if (seq !== requestSeq) return
    results.value = []
    errorMessage.value = t('space.load_failed')
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const handleSearch = () => {
  void loadSpaces(keyword.value.trim())
}

const toggleHierarchy = async (space: SpaceInfo) => {
  if (hierarchyId.value === space.spaceId) {
    hierarchyId.value = ''
    childSpaces.value = []
    return
  }

  hierarchyId.value = space.spaceId
  hierarchyLoadingId.value = space.spaceId
  childSpaces.value = []
  try {
    const { rooms } = await matrixSpaceService.getSpaceHierarchy(space.spaceId, { maxDepth: 2 })
    if (hierarchyId.value !== space.spaceId) return
    childSpaces.value = rooms
      .map(toChildSpace)
      .filter((child): child is SpaceInfo => child !== null && child.spaceId !== space.spaceId)
  } catch {
    if (hierarchyId.value === space.spaceId) childSpaces.value = []
  } finally {
    if (hierarchyLoadingId.value === space.spaceId) hierarchyLoadingId.value = ''
  }
}

const handleJoin = async (space: SpaceInfo) => {
  if (isJoinPending(space.spaceId)) return
  joiningId.value = space.spaceId
  try {
    if (space.joinRule === 'knock') {
      await matrixSpaceService.knockSpace(space.spaceId)
      requestedIds.value = [...requestedIds.value, space.spaceId]
      showFeedback(t('space.knock_success'), 'success')
    } else {
      await matrixSpaceService.joinSpace(space.spaceId)
      joinedIds.value = [...joinedIds.value, space.spaceId]
      showFeedback(t('space.join_success'), 'success')
      emit('joined', space.spaceId)
    }
  } catch {
    showFeedback(t(space.joinRule === 'knock' ? 'space.knock_failed' : 'space.join_failed'), 'error')
  } finally {
    joiningId.value = ''
  }
}

watch(
  () => props.show,
  (show) => {
    if (!show) return
    keyword.value = ''
    errorMessage.value = ''
    hierarchyId.value = ''
    childSpaces.value = []
    void loadSpaces('')
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.psd__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 160px;
}

.psd__search {
  display: flex;
  align-items: center;
  gap: 8px;
}

.psd__error {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-color-danger-500);
}

.psd__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 24px 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.psd__list,
.psd__child-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.psd__item {
  padding: 10px 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-lg);
  background: var(--tjg-surface-panel);
}

.psd__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.psd__avatar {
  flex-shrink: 0;
  border-radius: var(--tjg-radius-md);
  object-fit: cover;
}

.psd__avatar--child {
  border-radius: var(--tjg-radius-sm);
}

.psd__info {
  flex: 1;
  min-width: 0;
}

.psd__name {
  margin: 0;
  overflow: hidden;
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psd__meta,
.psd__topic {
  margin: 2px 0 0;
  overflow: hidden;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psd__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.psd__children {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--tjg-border-default);
}

.psd__child {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-list-hover);
}
</style>
