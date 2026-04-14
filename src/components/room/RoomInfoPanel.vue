<template>
  <n-drawer :show="visible" @update:show="emit('update:visible', $event)" :width="400" placement="right">
    <n-drawer-content :title="t('room.info.title')">
      <div v-if="room" class="room-info-panel">
        <div class="room-header">
          <n-avatar
            round
            :size="80"
            :src="avatarUrl"
            :style="{ backgroundColor: room.isDirect ? '#13987f' : '#1890ff' }">
            <template #fallback>
              <Icon :icon="room.isDirect ? 'mdi:account' : 'mdi:account-group'" :width="40" />
            </template>
          </n-avatar>
          <h3 class="room-name">{{ room.name || room.roomId }}</h3>
          <p v-if="room.topic" class="room-topic">{{ room.topic }}</p>
        </div>

        <n-divider />

        <div class="room-meta">
          <div class="meta-item">
            <span class="meta-label">{{ t('room.info.members') }}</span>
            <span class="meta-value">{{ room.memberCount || 0 }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ t('room.info.type') }}</span>
            <span class="meta-value">{{ room.isDirect ? t('room.info.direct') : t('room.info.group') }}</span>
          </div>
          <div v-if="room.isEncrypted" class="meta-item">
            <span class="meta-label">{{ t('room.info.encryption') }}</span>
            <span class="meta-value">
              <Icon icon="mdi:lock" :width="16" color="#52c41a" />
              {{ t('room.info.encrypted') }}
            </span>
          </div>
        </div>

        <n-divider />

        <div class="room-actions">
          <n-button type="primary" block @click="handleSendMessage">
            <template #icon>
              <Icon icon="mdi:message-text" :width="18" />
            </template>
            {{ t('room.info.send_message') }}
          </n-button>
          <n-button v-if="room.isDirect" block @click="handleCall">
            <template #icon>
              <Icon icon="mdi:phone" :width="18" />
            </template>
            {{ t('room.info.voice_call') }}
          </n-button>
          <n-button v-if="room.isDirect" block @click="handleVideoCall">
            <template #icon>
              <Icon icon="mdi:video" :width="18" />
            </template>
            {{ t('room.info.video_call') }}
          </n-button>
          <n-button block @click="handleSettings">
            <template #icon>
              <Icon icon="mdi:cog" :width="18" />
            </template>
            {{ t('room.info.settings') }}
          </n-button>
        </div>

        <n-divider />

        <div class="member-list">
          <h4 class="section-title">{{ t('room.info.member_list') }}</h4>
          <n-spin :show="loadingMembers">
            <div v-if="members.length === 0 && !loadingMembers" class="empty-members">
              {{ t('room.info.no_members') }}
            </div>
            <div v-else class="member-items">
              <div
                v-for="member in members"
                :key="member.userId"
                class="member-item"
                @click="handleMemberClick(member)">
                <n-avatar round :size="36">
                  {{ member.displayName?.charAt(0)?.toUpperCase() || '?' }}
                </n-avatar>
                <div class="member-info">
                  <span class="member-name">{{ member.displayName || member.userId }}</span>
                  <span class="member-role">{{ getRoleLabel(member.membership) }}</span>
                </div>
              </div>
            </div>
          </n-spin>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NDrawer, NDrawerContent, NAvatar, NDivider, NButton, NSpin, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomInfoPanel')
const { t } = useI18n()
const router = useRouter()
const message = useMessage()

const props = defineProps<{
  visible: boolean
  room: any
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const members = ref<any[]>([])
const loadingMembers = ref(false)

const avatarUrl = computed(() => {
  if (props.room?.avatarUrl) {
    return AvatarUtils.getAvatarUrl(props.room.avatarUrl)
  }
  return undefined
})

async function loadMembers() {
  if (!props.room?.roomId) return
  loadingMembers.value = true
  try {
    const roomMembers = await matrixRoomService.getMembers(props.room.roomId)
    members.value = roomMembers
  } catch (error) {
    logger.error('加载成员列表失败:', error)
  } finally {
    loadingMembers.value = false
  }
}

function getRoleLabel(membership: string): string {
  switch (membership) {
    case 'join':
      return t('room.info.role_member')
    case 'invite':
      return t('room.info.role_invited')
    case 'leave':
      return t('room.info.role_left')
    default:
      return membership
  }
}

function handleSendMessage() {
  router.push({ name: 'message', query: { roomId: props.room.roomId } })
  emit('update:visible', false)
}

function handleCall() {
  router.push({
    path: '/rtcCall',
    query: {
      roomId: props.room.roomId,
      callType: 'audio'
    }
  })
  emit('update:visible', false)
}

function handleVideoCall() {
  router.push({
    path: '/rtcCall',
    query: {
      roomId: props.room.roomId,
      callType: 'video'
    }
  })
  emit('update:visible', false)
}

function handleSettings() {
  router.push({ name: 'roomSettings', query: { roomId: props.room.roomId } })
  emit('update:visible', false)
}

function handleMemberClick(member: any) {
  message.info(`查看用户: ${member.displayName || member.userId}`)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible && props.room?.roomId) {
      loadMembers()
    }
  }
)
</script>

<style scoped lang="scss">
.room-info-panel {
  padding: 16px;
}

.room-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  .room-name {
    margin: 16px 0 8px 0;
    font-size: 18px;
    font-weight: 600;
  }

  .room-topic {
    margin: 0;
    font-size: 14px;
    color: #999;
  }
}

.room-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .meta-label {
    color: #999;
  }

  .meta-value {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.room-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-list {
  .section-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 500;
  }
}

.empty-members {
  text-align: center;
  color: #999;
  padding: 20px;
}

.member-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-color-hover);
  }
}

.member-info {
  margin-left: 12px;

  .member-name {
    display: block;
    font-size: 14px;
  }

  .member-role {
    display: block;
    font-size: 12px;
    color: #999;
  }
}
</style>
