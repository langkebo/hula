<template>
  <van-popup
    :show="visible" @update:show="emit('update:visible', $event)"
    position="bottom"
    round
    :style="{ height: '60%' }">
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between p-16px border-b border-gray-100">
        <span class="text-16px font-medium">{{ t('message.forward.title') }}</span>
        <Icon icon="mdi:close" :width="24" class="cursor-pointer" @click="$emit('update:visible', false)" />
      </div>

      <div class="p-12px">
        <van-search
          v-model="searchQuery"
          :placeholder="t('message.forward.search_placeholder')"
          shape="round" />
      </div>

      <div class="flex-1 overflow-auto px-12px">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px" />
        </div>

        <div v-else-if="filteredRooms.length === 0" class="flex flex-col items-center justify-center py-40px">
          <Icon icon="mdi:chat-outline" :width="48" color="#999" />
          <div class="text-14px text-gray-400 mt-16px">{{ t('message.forward.no_rooms') }}</div>
        </div>

        <van-checkbox-group v-else v-model="selectedRooms">
          <van-cell-group inset>
            <van-cell
              v-for="room in filteredRooms"
              :key="room.roomId"
              clickable
              @click="toggleRoom(room.roomId)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center overflow-hidden">
                  <img
                    v-if="room.avatar"
                    :src="room.avatar"
                    class="w-full h-full object-cover"
                    @error="handleAvatarError(room.roomId)" />
                  <Icon v-else icon="mdi:chat" :width="20" color="#999" />
                </div>
              </template>
              <template #title>
                <div class="flex items-center gap-8px">
                  <span class="text-14px">{{ room.name }}</span>
                  <Icon v-if="room.isEncrypted" icon="mdi:lock" :width="14" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-checkbox :name="room.roomId" @click.stop />
              </template>
            </van-cell>
          </van-cell-group>
        </van-checkbox-group>
      </div>

      <div class="p-16px border-t border-gray-100">
        <van-button
          type="primary"
          block
          round
          :disabled="selectedRooms.length === 0"
          :loading="forwarding"
          @click="handleForward">
          {{ t('message.forward.send') }}
          <template v-if="selectedRooms.length > 0">({{ selectedRooms.length }})</template>
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { matrixForwardService, matrixClientService } from '@/services/matrix'
import { useRoomStore } from '@/stores/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileForwardDialog')

const props = defineProps<{
  visible: boolean
  eventId: string
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'forwarded', roomIds: string[]): void
}>()

const { t } = useI18n()
const roomStore = useRoomStore()

const searchQuery = ref('')
const selectedRooms = ref<string[]>([])
const forwarding = ref(false)
const loading = ref(false)
const avatarErrors = ref<Set<string>>(new Set())

const filteredRooms = computed(() => {
  const roomsMap = roomStore.rooms
  if (!roomsMap) return []
  const rooms = Array.from(roomsMap.values())
  const query = searchQuery.value.toLowerCase()

  return rooms
    .filter((room: any) => room.roomId !== props.roomId)
    .filter((room: any) => !query || room.name?.toLowerCase().includes(query))
    .map((room: any) => ({
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatar: avatarErrors.value.has(room.roomId) ? null : AvatarUtils.getAvatarUrl(room.avatarUrl || ''),
      isEncrypted: room.isEncrypted || false
    }))
})

function handleAvatarError(roomId: string) {
  avatarErrors.value.add(roomId)
}

function toggleRoom(roomId: string) {
  const index = selectedRooms.value.indexOf(roomId)
  if (index === -1) {
    selectedRooms.value.push(roomId)
  } else {
    selectedRooms.value.splice(index, 1)
  }
}

async function handleForward() {
  if (selectedRooms.value.length === 0) return

  forwarding.value = true

  try {
    const room = matrixClientService.getRoom(props.roomId)
    if (!room) {
      throw new Error('房间不存在')
    }

    const event = room.findEventById(props.eventId)
    if (!event) {
      throw new Error('消息不存在')
    }

    const results = await matrixForwardService.forwardEventToMultipleRooms(event, selectedRooms.value)

    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    if (failCount > 0) {
      logger.warn(`转发完成: ${successCount} 成功, ${failCount} 失败`)
    }

    showToast({
      type: successCount > 0 ? 'success' : 'fail',
      message: successCount > 0 ? t('message.forward.success', { count: successCount }) : t('message.forward.failed')
    })

    emit(
      'forwarded',
      results.filter((r) => r.success).map((r) => r.roomId)
    )
    emit('update:visible', false)
    selectedRooms.value = []
  } catch (error) {
    logger.error('转发失败:', error)
    showToast({
      type: 'fail',
      message: t('message.forward.failed')
    })
  } finally {
    forwarding.value = false
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      selectedRooms.value = []
      searchQuery.value = ''
    }
  }
)
</script>

<style scoped></style>
