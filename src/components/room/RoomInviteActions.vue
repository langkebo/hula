<template>
  <div class="room-invite-actions flex items-center gap-2">
    <n-button size="small" type="primary" :loading="accepting" :disabled="disabled" @click="handleAccept">
      {{ t('room.invite.accept') }}
    </n-button>
    <n-button size="small" :loading="rejecting" :disabled="disabled" @click="handleReject">
      {{ t('room.invite.reject') }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomInviteActions')

const props = defineProps<{
  roomId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  accepted: [roomId: string]
  rejected: [roomId: string]
  error: [roomId: string, action: 'accept' | 'reject', error: unknown]
}>()

const { t } = useI18n()
const accepting = ref(false)
const rejecting = ref(false)

const handleAccept = async () => {
  if (accepting.value || rejecting.value) return
  accepting.value = true
  try {
    await matrixRoomActionFacade.joinRoom(props.roomId)
    emit('accepted', props.roomId)
  } catch (err) {
    logger.error(`接受邀请失败: ${err}`)
    emit('error', props.roomId, 'accept', err)
  } finally {
    accepting.value = false
  }
}

const handleReject = async () => {
  if (accepting.value || rejecting.value) return
  rejecting.value = true
  try {
    await matrixRoomActionFacade.leaveRoom(props.roomId)
    emit('rejected', props.roomId)
  } catch (err) {
    logger.error(`拒绝邀请失败: ${err}`)
    emit('error', props.roomId, 'reject', err)
  } finally {
    rejecting.value = false
  }
}
</script>
