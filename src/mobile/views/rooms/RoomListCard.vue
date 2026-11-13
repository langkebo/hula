<template>
  <van-swipe-cell>
    <MobileRoomCard
      :item="room"
      :summary-text="room.summary || t('mobile_rooms.no_message')"
      :time-label="formatRoomActiveTime(room.activeTime, t('menu.yesterday'))"
      :members-label="t('mobile_rooms.members')"
      :encrypted-label="t('mobile_rooms.encrypted')"
      @click="emit('select', room)" />
    <template #right>
      <van-button square type="danger" class="h-full" @click="emit('leave', room.roomId)">
        {{ t('mobile_rooms.leave_room') }}
      </van-button>
    </template>
  </van-swipe-cell>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MobileRoomCard from '@/mobile/components/rooms/MobileRoomCard.vue'
import { formatRoomActiveTime, type RoomCardModel } from '@/mobile/views/rooms/roomListModel'

defineOptions({
  name: 'RoomListCard'
})

defineProps<{
  room: RoomCardModel
}>()

const emit = defineEmits<{
  select: [room: RoomCardModel]
  leave: [roomId: string]
}>()

const { t } = useI18n()
</script>
