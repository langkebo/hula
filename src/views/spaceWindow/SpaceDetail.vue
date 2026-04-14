<template>
  <div class="space-detail">
    <div class="space-header">
      <div class="header-left">
        <n-button text @click="router.back()">
          <template #icon>
            <Icon icon="mdi:arrow-left" :width="20" />
          </template>
        </n-button>
        <n-avatar
          round
          :size="48"
          :src="space?.avatarUrl ?? undefined"
          :fallback-src="defaultAvatar">
          {{ space?.name?.charAt(0)?.toUpperCase() || 'S' }}
        </n-avatar>
        <div class="space-title">
          <h2>{{ space?.name || t('space.loading') }}</h2>
          <span class="space-meta">{{ space?.memberCount || 0 }} {{ t('space.members') }}</span>
        </div>
      </div>
      <div class="header-right">
        <n-button @click="showEditDialog = true">
          <template #icon>
            <Icon icon="mdi:cog" :width="18" />
          </template>
          {{ t('space.settings') }}
        </n-button>
      </div>
    </div>

    <n-divider style="margin: 0" />

    <div class="space-content">
      <n-tabs v-model:value="activeTab" type="line">
        <n-tab-pane name="rooms" :tab="t('space.rooms')">
          <div class="tab-content">
            <div class="tab-header">
              <n-button type="primary" size="small" @click="showAddRoomDialog = true">
                <template #icon>
                  <Icon icon="mdi:plus" :width="16" />
                </template>
                {{ t('space.add_room') }}
              </n-button>
            </div>

            <n-spin :show="loadingRooms">
              <div v-if="childRooms.length === 0 && !loadingRooms" class="empty-tab">
                <Icon icon="mdi:chat-outline" :width="48" color="#999" />
                <p>{{ t('space.no_rooms') }}</p>
              </div>

              <div v-else class="room-list">
                <div
                  v-for="room in childRooms"
                  :key="room.room_id"
                  class="room-item"
                  @click="handleRoomClick(room.room_id)">
                  <n-avatar round :size="40">
                    {{ room.name?.charAt(0)?.toUpperCase() || 'R' }}
                  </n-avatar>
                  <div class="room-info">
                    <span class="room-name">{{ room.name || room.room_id }}</span>
                    <span class="room-meta">{{ room.member_count || 0 }} {{ t('space.members') }}</span>
                  </div>
                  <n-button
                    text
                    type="error"
                    @click.stop="handleRemoveRoom(room.room_id)">
                    <Icon icon="mdi:close" :width="18" />
                  </n-button>
                </div>
              </div>
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane name="members" :tab="t('space.members')">
          <div class="tab-content">
            <div class="tab-header">
              <n-button type="primary" size="small" @click="showInviteDialog = true">
                <template #icon>
                  <Icon icon="mdi:account-plus" :width="16" />
                </template>
                {{ t('space.invite_member') }}
              </n-button>
            </div>

            <n-spin :show="loadingMembers">
              <div v-if="members.length === 0 && !loadingMembers" class="empty-tab">
                <Icon icon="mdi:account-outline" :width="48" color="#999" />
                <p>{{ t('space.no_members') }}</p>
              </div>

              <div v-else class="member-list">
                <div
                  v-for="member in members"
                  :key="member.user_id"
                  class="member-item">
                  <n-avatar round :size="40">
                    {{ member.displayname?.charAt(0)?.toUpperCase() || '?' }}
                  </n-avatar>
                  <div class="member-info">
                    <span class="member-name">{{ member.displayname || member.user_id }}</span>
                    <span class="member-role">{{ getRoleLabel(member.role) }}</span>
                  </div>
                </div>
              </div>
            </n-spin>
          </div>
        </n-tab-pane>

        <n-tab-pane name="hierarchy" :tab="t('space.hierarchy')">
          <div class="tab-content">
            <n-spin :show="loadingHierarchy">
              <div v-if="!hierarchy" class="empty-tab">
                <Icon icon="mdi:family-tree" :width="48" color="#999" />
                <p>{{ t('space.no_hierarchy') }}</p>
              </div>

              <div v-else class="hierarchy-tree">
                <div class="tree-node root">
                  <Icon icon="mdi:folder" :width="24" color="#13987f" />
                  <span>{{ space?.name }}</span>
                </div>
                <div
                  v-for="child in hierarchy.children"
                  :key="child.room_id"
                  class="tree-node child">
                  <Icon icon="mdi:chat" :width="20" color="#666" />
                  <span>{{ child.name || child.room_id }}</span>
                </div>
              </div>
            </n-spin>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

    <AddToSpaceDialog
      v-model:visible="showAddRoomDialog"
      :space-id="spaceId"
      @added="loadChildRooms" />

    <CreateSpaceDialog
      v-model:visible="showEditDialog"
      :edit-mode="true"
      :space="space"
      @updated="handleSpaceUpdated" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { matrixSpaceService } from '@/services/matrix/MatrixSpaceService'
import { useSpaceStore, type Space } from '@/stores/space'
import { createLogger } from '@/utils/Logger'
import CreateSpaceDialog from '@/components/space/CreateSpaceDialog.vue'
import AddToSpaceDialog from '@/components/space/AddToSpaceDialog.vue'

const logger = createLogger('SpaceDetail')

const route = useRoute()
const router = useRouter()
const message = useMessage()
const { t } = useI18n()
const spaceStore = useSpaceStore()

const spaceId = computed(() => route.params.roomId as string)
const space = computed(() => spaceStore.activeSpace)

const activeTab = ref('rooms')
const loadingRooms = ref(false)
const loadingMembers = ref(false)
const loadingHierarchy = ref(false)
const showAddRoomDialog = ref(false)
const showEditDialog = ref(false)
const showInviteDialog = ref(false)

const childRooms = ref<any[]>([])
const members = ref<any[]>([])
const hierarchy = ref<any>(null)

const defaultAvatar = '/images/default-avatar.png'

async function loadSpace() {
  if (!spaceId.value) return

  try {
    const spaceInfo = await matrixSpaceService.getSpace(spaceId.value)
    if (spaceInfo) {
      spaceStore.addSpace({
        roomId: spaceInfo.spaceId,
        name: spaceInfo.name,
        avatarUrl: spaceInfo.avatarUrl ?? null,
        memberCount: spaceInfo.memberCount,
        isJoined: true,
        topic: spaceInfo.topic,
        childCount: spaceInfo.childCount,
        spaceId: spaceInfo.spaceId
      })
      spaceStore.setActiveSpace(spaceId.value)
    }
  } catch (error) {
    logger.error('加载空间失败:', error)
    message.error(t('space.load_failed'))
  }
}

async function loadChildRooms() {
  if (!spaceId.value) return
  loadingRooms.value = true

  try {
    const children = await matrixSpaceService.getSpaceChildren(spaceId.value)
    childRooms.value = children
  } catch (error) {
    logger.error('加载子房间失败:', error)
  } finally {
    loadingRooms.value = false
  }
}

async function loadMembers() {
  if (!spaceId.value) return
  loadingMembers.value = true

  try {
    const spaceMembers = await matrixSpaceService.getSpaceMembers(spaceId.value)
    members.value = spaceMembers
  } catch (error) {
    logger.error('加载成员失败:', error)
  } finally {
    loadingMembers.value = false
  }
}

async function loadHierarchy() {
  if (!spaceId.value) return
  loadingHierarchy.value = true

  try {
    const spaceHierarchy = await matrixSpaceService.getSpaceHierarchy(spaceId.value)
    hierarchy.value = spaceHierarchy
  } catch (error) {
    logger.error('加载层级结构失败:', error)
  } finally {
    loadingHierarchy.value = false
  }
}

function handleRoomClick(roomId: string) {
  router.push({ name: 'message', query: { roomId } })
}

async function handleRemoveRoom(roomId: string) {
  try {
    await matrixSpaceService.removeChildFromSpace(spaceId.value, roomId)
    message.success(t('space.room_removed'))
    await loadChildRooms()
  } catch (error) {
    logger.error('移除房间失败:', error)
    message.error(t('space.room_remove_failed'))
  }
}

function handleSpaceUpdated(updatedSpace: {
  spaceId: string
  name: string
  avatarUrl?: string
  memberCount: number
  topic?: string
  childCount?: number
}) {
  showEditDialog.value = false
  spaceStore.addSpace({
    roomId: updatedSpace.spaceId,
    name: updatedSpace.name,
    avatarUrl: updatedSpace.avatarUrl ?? null,
    memberCount: updatedSpace.memberCount,
    isJoined: true,
    topic: updatedSpace.topic,
    childCount: updatedSpace.childCount,
    spaceId: updatedSpace.spaceId
  })
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return t('space.role_admin')
    case 'moderator':
      return t('space.role_moderator')
    default:
      return t('space.role_member')
  }
}

watch(spaceId, () => {
  loadSpace()
  loadChildRooms()
  loadMembers()
  loadHierarchy()
})

onMounted(() => {
  loadSpace()
  loadChildRooms()
  loadMembers()
  loadHierarchy()
})
</script>

<style scoped lang="scss">
.space-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.space-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .space-title {
    h2 {
      margin: 0;
      font-size: 18px;
    }

    .space-meta {
      font-size: 13px;
      color: #999;
    }
  }
}

.space-content {
  flex: 1;
  overflow: hidden;

  :deep(.n-tabs) {
    height: 100%;
  }

  :deep(.n-tabs-pane-wrapper) {
    height: calc(100% - 40px);
    overflow-y: auto;
  }
}

.tab-content {
  padding: 16px;
}

.tab-header {
  margin-bottom: 16px;
}

.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #999;
}

.room-list,
.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-item,
.member-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-color-hover);
  }
}

.room-info,
.member-info {
  flex: 1;
  margin-left: 12px;

  .room-name,
  .member-name {
    display: block;
    font-size: 14px;
  }

  .room-meta,
  .member-role {
    display: block;
    font-size: 12px;
    color: #999;
  }
}

.hierarchy-tree {
  padding: 16px;

  .tree-node {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;

    &.root {
      font-weight: 600;
    }

    &.child {
      margin-left: 32px;
    }
  }
}
</style>
