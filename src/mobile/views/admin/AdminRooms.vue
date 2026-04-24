<template>
  <mobile-layout :title="t('admin.rooms')" show-back>
    <div class="mobile-admin-rooms">
      <van-search v-model="admin.searchQuery.value" :placeholder="t('admin.search_rooms')" @search="onRefresh" />

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="admin.loading.value" :finished="true" :finished-text="t('common.no_more')">
          <van-cell
            v-for="room in admin.filteredRooms.value"
            :key="room.roomId"
            :title="room.name || room.roomId"
            :label="room.roomId"
            is-link
            @click="handleRoomClick(room)">
            <template #value>
              <van-tag v-if="room.public" type="success">{{ t('admin.public') }}</van-tag>
              <van-tag v-else type="default">{{ t('admin.private') }}</van-tag>
              <span class="member-count">{{ room.joinedMembers }}</span>
            </template>
          </van-cell>
        </van-list>
      </van-pull-refresh>

      <van-popup v-model:show="showRoomDetail" position="bottom" :style="{ height: '70%' }">
        <div v-if="admin.selectedRoom.value" class="room-detail">
          <h3>{{ admin.selectedRoom.value.name || admin.selectedRoom.value.roomId }}</h3>
          <p class="room-id">{{ admin.selectedRoom.value.roomId }}</p>
          <van-divider />
          <van-cell-group>
            <van-cell :title="t('admin.members')" :value="String(admin.selectedRoom.value.joinedMembers)" />
            <van-cell :title="t('admin.creator')" :value="admin.selectedRoom.value.creator || '-'" />
          </van-cell-group>
          <div class="room-actions">
            <van-button type="warning" block @click="handleBlockRoom">{{ t('admin.block_room') }}</van-button>
            <van-button type="danger" block @click="handleDeleteRoom">{{ t('admin.delete_room') }}</van-button>
          </div>
        </div>
      </van-popup>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, showConfirmDialog } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminRooms } from '@/composables/admin'
import type { RoomInfo } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminRooms')
const { t } = useI18n()

const admin = useAdminRooms()
const refreshing = ref(false)
const showRoomDetail = ref(false)

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadRooms(200, admin.searchQuery.value || undefined)
  } catch (error) {
    logger.error('[MobileAdminRooms] 加载房间失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const handleRoomClick = async (room: RoomInfo) => {
  showRoomDetail.value = true
  await admin.selectRoom(room)
}

const handleBlockRoom = async () => {
  if (!admin.selectedRoom.value) return
  try {
    await showConfirmDialog({ title: t('admin.confirm'), message: t('admin.block_room_confirm') })
    await admin.blockRoom(admin.selectedRoom.value.roomId, true)
    showToast(t('admin.operation_success'))
    showRoomDetail.value = false
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('[MobileAdminRooms] 屏蔽房间失败:', error)
      showToast(t('admin.load_failed'))
    }
  }
}

const handleDeleteRoom = async () => {
  if (!admin.selectedRoom.value) return
  try {
    await showConfirmDialog({ title: t('admin.confirm'), message: t('admin.delete_room_confirm') })
    await admin.deleteRoom(admin.selectedRoom.value.roomId, { purge: true })
    showToast(t('admin.operation_success'))
    showRoomDetail.value = false
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('[MobileAdminRooms] 删除房间失败:', error)
      showToast(t('admin.load_failed'))
    }
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-rooms {
  .van-search {
    padding: 12px 16px;
  }
  .member-count {
    margin-left: 8px;
    font-size: 13px;
    color: var(--van-text-color-2);
  }
}
.room-detail {
  padding: 16px;
  h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
  }
  .room-id {
    margin: 0 0 12px 0;
    font-size: 12px;
    color: var(--van-text-color-2);
    word-break: break-all;
  }
  .room-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
}
</style>
