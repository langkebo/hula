<template>
  <div class="space-children" data-testid="space-children">
    <div class="children-header">
      <span class="children-title">{{ t('space.child_rooms') }}</span>
      <van-button size="mini" plain type="primary" data-testid="space-create-room" @click="showCreate = !showCreate">
        <template #icon><van-icon name="plus" /></template>
        {{ t('space.create_room') }}
      </van-button>
    </div>

    <div v-if="showCreate" class="children-create">
      <van-field
        v-model="roomName"
        :placeholder="t('space.create_room_name_placeholder')"
        data-testid="space-room-name" />
      <van-button size="small" type="primary" :loading="mutating" data-testid="space-room-submit" @click="handleCreate">
        {{ t('common.confirm') }}
      </van-button>
    </div>

    <div v-if="pendingAttachRoomId" class="children-attach" data-testid="space-room-attach" role="alert">
      <span class="children-attach-text">{{ t('space.create_room_attach_failed') }}</span>
      <van-button
        size="mini"
        type="warning"
        :loading="mutating"
        data-testid="space-room-attach-retry"
        @click="handleAttachRetry">
        {{ t('space.create_room_attach_retry') }}
      </van-button>
    </div>

    <MobileAsyncState :state="asyncState" test-id="space-rooms" :empty-text="t('space.no_rooms')" min-height="80px">
      <div class="children-list">
        <div
          v-for="room in rooms"
          :key="room.roomId"
          v-clickable
          class="child-row"
          :data-room-id="room.roomId"
          @click="openRoom(room)">
          <div class="child-avatar">
            <img v-if="room.avatarUrl" :src="room.avatarUrl" :alt="room.name" />
            <van-icon v-else name="chat-o" size="20" />
          </div>
          <div class="child-name">{{ room.name || room.roomId }}</div>
          <span v-if="room.suggested" class="child-badge">{{ t('space.suggested_label') }}</span>
          <!-- 未加入的子房间不能直接进聊天页，这里显式区分「加入」与「进入」（P-5） -->
          <span v-if="!room.joined" class="child-join">
            {{ joiningRoomId === room.roomId ? t('common.loading') : t('space.join') }}
          </span>
          <van-icon v-else name="arrow" class="child-chevron" />
        </div>
      </div>
    </MobileAsyncState>
  </div>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSpaceRooms } from '@/composables/space'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { useMobileErrorText } from '@/mobile/composables/useMobileErrorText'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { createLogger } from '@/utils/Logger'

/**
 * 空间子房间列表（移动端）。
 *
 * 背景：`SpaceView` 之前只渲染「空间卡片 + 成员/房间计数」，
 * `useSpaceRooms` 的 `rooms` / `load` / `createRoomInSpace` 一个都没接 ——
 * 于是「空间里有房间」这件事在移动端**完全看不见**（详情层只有按 roomId 添加）。
 *
 * 这里补上最小可用的树形视图：空间（父）→ 子房间（子，可点击进入聊天）+ 内联新建。
 * 数据源仍是 `MatrixSpaceService`（`m.space.child` 状态事件），不在前端自造层级。
 */
defineOptions({ name: 'SpaceChildrenList' })

const props = defineProps<{ spaceId: string }>()

const { t } = useI18n()
const router = useRouter()
const logger = createLogger('SpaceChildrenList')
const { resolve: resolveErrorText } = useMobileErrorText()

const { rooms, loading, mutating, load, createRoomInSpace, addRoom } = useSpaceRooms(() => props.spaceId)

const showCreate = ref(false)
const roomName = ref('')
/** 房间已建、未入空间的中间态：保留房间 ID 供一键重新加入 */
const pendingAttachRoomId = ref('')
/** 正在加入的子房间 ID，用于行内 loading 并阻止重复点击 */
const joiningRoomId = ref('')

/** 四态：首次加载中、空、就绪；统一交给 MobileAsyncState 渲染 */
const asyncState = computed<'loading' | 'empty' | 'ready'>(() => {
  if (loading.value && rooms.value.length === 0) return 'loading'
  return rooms.value.length === 0 ? 'empty' : 'ready'
})

watch(
  () => props.spaceId,
  async (id) => {
    showCreate.value = false
    roomName.value = ''
    pendingAttachRoomId.value = ''
    if (!id) return
    await load()
  },
  { immediate: true }
)

const handleCreate = async () => {
  const name = roomName.value.trim()
  if (!name) {
    showToast(t('space.create_room_name_required'))
    return
  }
  const result = await createRoomInSpace({ name })
  if (!result.roomId) {
    showToast(t('space.create_room_failed'))
    return
  }
  // 房间已建但未挂载：房间可用，按中间态提示并给出一键重新加入，避免用户以为失败而重复创建
  showToast(result.attached ? t('space.create_room_success') : t('space.create_room_attach_failed'))
  pendingAttachRoomId.value = result.attached ? '' : result.roomId
  roomName.value = ''
  showCreate.value = false
  logger.info(`Child room created for space ${props.spaceId}: ${result.roomId}, attached=${result.attached}`)
}

/** 中间态重试：把已创建的房间重新挂载到当前空间 */
const handleAttachRetry = async () => {
  const roomId = pendingAttachRoomId.value
  if (!roomId) return
  const ok = await addRoom(roomId)
  showToast(ok ? t('space.create_room_success') : t('space.add_room_failed'))
  if (ok) pendingAttachRoomId.value = ''
}

const openRoom = async (room: SpaceChildRoom) => {
  if (!room.roomId) return
  if (room.joined) {
    void router.push({ name: 'mobileChatMain', params: { roomId: room.roomId } })
    return
  }
  if (joiningRoomId.value) return
  joiningRoomId.value = room.roomId
  try {
    await matrixRoomMembershipService.joinRoom(room.roomId)
    showToast(t('space.join_success'))
    void router.push({ name: 'mobileChatMain', params: { roomId: room.roomId } })
  } catch (err) {
    logger.error(`Join child room failed: ${room.roomId}`, err)
    showToast({ type: 'fail', message: resolveErrorText(err) })
  } finally {
    joiningRoomId.value = ''
  }
}
</script>

<style scoped lang="scss">
.space-children {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.children-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .children-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--van-text-color);
  }
}

.children-create {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-radius: var(--tjg-radius-md, 8px);
  background: var(--tjg-glass-row-bg);
}

.children-attach {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding: 8px;
  border-radius: var(--tjg-radius-md, 8px);
  background: var(--tjg-color-warning-bg);
  color: var(--tjg-color-warning-700);
  font-size: 12px;
  line-height: 1.4;
}

.children-list {
  display: flex;
  flex-direction: column;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-radius: var(--tjg-radius-md, 8px);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  &:active {
    background: var(--tjg-glass-row-bg-pressed);
  }

  .child-avatar {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--van-gray-2);
    color: var(--van-gray-6);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .child-name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .child-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    color: var(--van-primary-color);
    background: var(--tjg-color-primary-100);
  }

  .child-join {
    flex-shrink: 0;
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 999px;
    color: var(--van-primary-color);
    border: 1px solid var(--van-primary-color);
  }

  .child-chevron {
    color: var(--van-text-color-3);
  }
}
</style>
