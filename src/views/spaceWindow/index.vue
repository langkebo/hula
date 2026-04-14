<template>
  <div class="space-window">
    <div class="space-header">
      <div class="header-left">
        <h2>{{ t('space.title') }}</h2>
        <n-button type="primary" @click="showCreateDialog = true">
          <template #icon>
            <Icon icon="mdi:plus" :width="18" />
          </template>
          {{ t('space.create') }}
        </n-button>
      </div>
      <div class="header-right">
        <n-input
          v-model:value="searchQuery"
          :placeholder="t('space.search_placeholder')"
          clearable
          style="width: 200px">
          <template #prefix>
            <Icon icon="mdi:magnify" :width="18" />
          </template>
        </n-input>
      </div>
    </div>

    <n-divider style="margin: 0" />

    <div class="space-content">
      <n-spin :show="loading">
        <div v-if="filteredSpaces.length === 0 && !loading" class="empty-state">
          <Icon icon="mdi:folder-multiple-outline" :width="64" color="#999" />
          <p>{{ t('space.empty') }}</p>
          <n-button type="primary" @click="showCreateDialog = true">
            {{ t('space.create_first') }}
          </n-button>
        </div>

        <div v-else class="space-grid">
          <div
            v-for="space in filteredSpaces"
            :key="space.spaceId"
            class="space-card"
            @click="handleSpaceClick(space)">
            <div class="space-avatar">
              <n-avatar
                round
                :size="64"
                :src="space.avatarUrl ?? undefined"
                :fallback-src="defaultAvatar">
                {{ space.name?.charAt(0)?.toUpperCase() || 'S' }}
              </n-avatar>
            </div>
            <div class="space-info">
              <h3 class="space-name">{{ space.name }}</h3>
              <p class="space-meta">
                <span>{{ space.memberCount }} {{ t('space.members') }}</span>
                <span class="separator">·</span>
                <span>{{ space.childCount }} {{ t('space.rooms') }}</span>
              </p>
              <p v-if="space.topic" class="space-topic">{{ space.topic }}</p>
            </div>
            <div class="space-actions">
              <n-button text @click.stop="handleEditSpace(space)">
                <Icon icon="mdi:cog" :width="20" />
              </n-button>
            </div>
          </div>
        </div>
      </n-spin>
    </div>

    <CreateSpaceDialog v-model:visible="showCreateDialog" @created="handleSpaceCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NInput, NDivider, NSpin, NAvatar, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { matrixSpaceService } from '@/services/matrix/MatrixSpaceService'
import { useSpaceStore, type Space } from '@/stores/space'
import { createLogger } from '@/utils/Logger'
import CreateSpaceDialog from '@/components/space/CreateSpaceDialog.vue'

const logger = createLogger('SpaceWindow')

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const spaceStore = useSpaceStore()

const loading = ref(false)
const searchQuery = ref('')
const showCreateDialog = ref(false)
const defaultAvatar = '/images/default-avatar.png'

const spaces = computed(() => spaceStore.spaces)

const filteredSpaces = computed(() => {
  if (!searchQuery.value) return spaces.value
  const query = searchQuery.value.toLowerCase()
  return spaces.value.filter(
    (space) => space.name?.toLowerCase().includes(query) || space.topic?.toLowerCase().includes(query)
  )
})

async function loadSpaces() {
  loading.value = true
  try {
    const userSpaces = await matrixSpaceService.getUserSpaces()
    spaceStore.setSpaces(
      userSpaces.map((s) => ({
        roomId: s.spaceId,
        name: s.name,
        avatarUrl: s.avatarUrl ?? null,
        memberCount: s.memberCount,
        isJoined: true,
        topic: s.topic,
        childCount: s.childCount,
        spaceId: s.spaceId
      }))
    )
  } catch (error) {
    logger.error('加载空间列表失败:', error)
    message.error(t('space.load_failed'))
  } finally {
    loading.value = false
  }
}

function handleSpaceClick(space: Space) {
  router.push({ name: 'spaceDetail', params: { roomId: space.roomId } })
}

function handleEditSpace(space: Space) {
  router.push({ name: 'spaceDetail', params: { roomId: space.roomId }, query: { edit: 'true' } })
}

function handleSpaceCreated(space: { spaceId: string; name: string; avatarUrl?: string; memberCount: number }) {
  showCreateDialog.value = false
  spaceStore.addSpace({
    roomId: space.spaceId,
    name: space.name,
    avatarUrl: space.avatarUrl ?? null,
    memberCount: space.memberCount,
    isJoined: true,
    spaceId: space.spaceId
  })
  message.success(t('space.create.success'))
}

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.space-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }
}

.space-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;

  p {
    color: #999;
    font-size: 16px;
  }
}

.space-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.space-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--bg-color-secondary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-color-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.space-avatar {
  flex-shrink: 0;
  margin-right: 16px;
}

.space-info {
  flex: 1;
  min-width: 0;

  .space-name {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .space-meta {
    margin: 0 0 4px 0;
    font-size: 13px;
    color: #999;

    .separator {
      margin: 0 8px;
    }
  }

  .space-topic {
    margin: 0;
    font-size: 13px;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.space-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;

  .space-card:hover & {
    opacity: 1;
  }
}
</style>
