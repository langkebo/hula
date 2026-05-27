<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('space.discovery.title')"
    :style="{ width: '680px', maxHeight: '80vh' }"
    :bordered="false"
    :segmented="{ content: true, footer: true }"
    @update:show="$emit('update:visible', $event)">
    <div class="space-discovery">
      <div class="discovery-search">
        <n-input
          v-model:value="searchQuery"
          :placeholder="t('space.discovery.search_placeholder')"
          clearable
          @keydown.enter="handleSearch">
          <template #prefix>
            <Icon icon="mdi:magnify" class="search-icon" />
          </template>
        </n-input>
      </div>

      <n-tabs v-model:value="activeTab" type="line" animated>
        <n-tab-pane name="public" :tab="t('space.discovery.tab_public')">
          <div class="tab-content">
            <n-spin :show="loading && activeTab === 'public'">
              <div v-if="searchQuery && searchResults.length > 0" class="space-list">
                <div v-for="space in searchResults" :key="space.spaceId" class="space-item">
                  <n-avatar round :size="40" :src="space.avatarUrl || undefined">
                    {{ space.name?.charAt(0) || '?' }}
                  </n-avatar>
                  <div class="space-item-info">
                    <div class="space-item-name">{{ space.name }}</div>
                    <div class="space-item-meta">
                      <span class="meta-item">
                        <Icon icon="mdi:account-group-outline" />
                        {{ space.memberCount }}
                      </span>
                      <span v-if="space.topic" class="space-item-topic">{{ truncateTopic(space.topic) }}</span>
                    </div>
                  </div>
                  <n-button size="small" type="primary" secondary @click="handleJoinSpace(space.spaceId)">
                    {{ t('space.discovery.join') }}
                  </n-button>
                </div>
              </div>
              <div v-else-if="!searchQuery" class="space-list">
                <div v-for="space in publicSpaces" :key="space.spaceId" class="space-item">
                  <n-avatar round :size="40" :src="space.avatarUrl || undefined">
                    {{ space.name?.charAt(0) || '?' }}
                  </n-avatar>
                  <div class="space-item-info">
                    <div class="space-item-name">{{ space.name }}</div>
                    <div class="space-item-meta">
                      <span class="meta-item">
                        <Icon icon="mdi:account-group-outline" />
                        {{ space.memberCount }}
                      </span>
                      <span v-if="space.topic" class="space-item-topic">{{ truncateTopic(space.topic) }}</span>
                    </div>
                  </div>
                  <n-button size="small" type="primary" secondary @click="handleJoinSpace(space.spaceId)">
                    {{ t('space.discovery.join') }}
                  </n-button>
                </div>
              </div>
              <n-empty
                v-if="
                  (searchQuery && searchResults.length === 0 && !loading) ||
                  (!searchQuery && publicSpaces.length === 0 && !loading)
                "
                :description="
                  searchQuery ? t('space.discovery.no_search_results') : t('space.discovery.no_public_spaces')
                " />
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane name="my" :tab="t('space.discovery.tab_my')">
          <div class="tab-content">
            <n-spin :show="loading && activeTab === 'my'">
              <div v-if="userSpaces.length > 0" class="space-list">
                <div v-for="space in userSpaces" :key="space.spaceId" class="space-item">
                  <n-avatar round :size="40" :src="space.avatarUrl || undefined">
                    {{ space.name?.charAt(0) || '?' }}
                  </n-avatar>
                  <div class="space-item-info">
                    <div class="space-item-name">{{ space.name }}</div>
                    <div class="space-item-meta">
                      <span class="meta-item">
                        <Icon icon="mdi:account-group-outline" />
                        {{ space.memberCount }}
                      </span>
                      <span v-if="space.topic" class="space-item-topic">{{ truncateTopic(space.topic) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <n-empty v-if="userSpaces.length === 0 && !loading" :description="t('space.discovery.no_user_spaces')" />
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane name="statistics" :tab="t('space.discovery.tab_statistics')">
          <div class="tab-content">
            <n-spin :show="loading && activeTab === 'statistics'">
              <div v-if="statistics" class="statistics-grid">
                <n-card size="small" class="stat-card">
                  <n-statistic :label="t('space.discovery.stat_total_spaces')" :value="statistics.totalSpaces">
                    <template #prefix>
                      <Icon icon="mdi:domain" />
                    </template>
                  </n-statistic>
                </n-card>
                <n-card size="small" class="stat-card">
                  <n-statistic :label="t('space.discovery.stat_total_members')" :value="statistics.totalMembers">
                    <template #prefix>
                      <Icon icon="mdi:account-group" />
                    </template>
                  </n-statistic>
                </n-card>
                <n-card size="small" class="stat-card">
                  <n-statistic :label="t('space.discovery.stat_total_rooms')" :value="statistics.totalRooms">
                    <template #prefix>
                      <Icon icon="mdi:door-open" />
                    </template>
                  </n-statistic>
                </n-card>
              </div>
              <n-empty v-if="!statistics && !loading" :description="t('space.discovery.no_statistics')" />
            </n-spin>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceDiscovery } from '@/composables/space/useSpaceDiscovery'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpaceDiscovery')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  joined: [spaceId: string]
}>()

const {
  loading,
  publicSpaces,
  searchResults,
  statistics,
  userSpaces,
  loadPublicSpaces,
  searchSpaces,
  loadStatistics,
  loadUserSpaces
} = useSpaceDiscovery()

const searchQuery = ref('')
const activeTab = ref('public')

const truncateTopic = (topic: string, maxLen = 60): string => {
  if (topic.length <= maxLen) return topic
  return topic.slice(0, maxLen) + '...'
}

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) return
  await searchSpaces(query)
}

const handleJoinSpace = async (spaceId: string) => {
  try {
    await matrixSpaceService.joinSpace(spaceId)
    showFeedback(t('space.discovery.join_success'), 'success')
    emit('joined', spaceId)
  } catch (err) {
    logger.error('join space failed', err)
    showFeedback(t('space.discovery.join_failed'), 'error')
  }
}

const loadTabData = async () => {
  switch (activeTab.value) {
    case 'public':
      await loadPublicSpaces()
      break
    case 'my':
      await loadUserSpaces()
      break
    case 'statistics':
      await loadStatistics()
      break
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      searchQuery.value = ''
      activeTab.value = 'public'
      loadTabData()
    }
  }
)

watch(activeTab, () => {
  loadTabData()
})
</script>

<style scoped lang="scss">
.space-discovery {
  display: flex;
  flex-direction: column;
  min-height: 400px;
  max-height: 60vh;
}

.discovery-search {
  margin-bottom: 12px;
}

.search-icon {
  font-size: 16px;
  color: var(--hula-text-secondary);
}

.tab-content {
  padding: 8px 0;
}

.space-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.space-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--hula-bg-secondary);
  }
}

.space-item-info {
  flex: 1;
  min-width: 0;
}

.space-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--hula-text-secondary);
}

.space-item-topic {
  font-size: 12px;
  color: var(--hula-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  text-align: center;
}
</style>
