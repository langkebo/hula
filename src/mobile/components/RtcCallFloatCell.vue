<template>
  <transition name="rtc-call-float" mode="out-in">
    <div v-if="isVisible" class="fixed inset-x-16px z-9999 pointer-events-none" :style="{ top: topOffset }">
      <div class="mx-auto pointer-events-auto" :style="{ maxWidth: '360px' }">
        <div class="rtc-call-card flex items-center gap-12px">
          <div class="size-48px shrink-0 overflow-hidden rounded-14px avatar-shell">
            <img :src="avatarUrl" alt="incoming-call-avatar" class="size-full object-cover" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="text-15px font-semibold text-white truncate">{{ displayName }}</div>
            <div class="mt-4px text-12px text-#FFFFFFB3 truncate">{{ callMessage }}</div>
          </div>

          <div class="flex items-center gap-18px">
            <div class="rtc-action-button reject" @click="handleReject">
              <svg class="size-20px color-[--tjg-text-inverse]">
                <use href="#PhoneHangup"></use>
              </svg>
            </div>

            <div class="rtc-action-button accept" @click="handleAccept">
              <svg class="size-20px color-[--tjg-text-inverse]">
                <use href="#phone-telephone-entity"></use>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import { CallTypeEnum, MittEnum } from '@/enums'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMobileStore } from '@/stores/domains/settings/mobile'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RtcCallFloatCell')

const sendMatrixVoipSignal = async (type: string, data: unknown) => {
  logger.warn('Matrix VoIP Signal:', type, data)
}

type CallPayload = {
  callerUid?: string
  callerId?: string
  senderId?: string
  targetUid?: string
  targetIds?: string[]
  roomId?: string
  isVideo?: boolean
  video?: boolean
  name?: string
  callerName?: string
  avatar?: string
}

const router = useRouter()
const mobileStore = useMobileStore()
const groupStore = useGroupStore()
const userStore = useUserStore()
const { t } = useI18n()

const currentCall = ref<{
  callerUid: string
  roomId: string
  callType: CallTypeEnum
  displayName: string
  avatar: string
} | null>(null)

const topOffset = computed(() => {
  const safeTop = mobileStore.safeArea.top
  const base = safeTop > 0 ? safeTop + 16 : 16
  return `${base}px`
})

const isVisible = computed(() => currentCall.value !== null)

const avatarUrl = computed(() => currentCall.value?.avatar ?? AvatarUtils.getAvatarUrl(''))

const displayName = computed(() => currentCall.value?.displayName || '未知用户')

const callMessage = computed(() => {
  if (!currentCall.value) return ''
  return currentCall.value.callType === CallTypeEnum.VIDEO
    ? t('mobile_voice_video.video_call_invitation')
    : t('mobile_voice_video.audio_call_invitation')
})

const toAvatarUrl = (raw?: unknown) => {
  if (typeof raw === 'string') return AvatarUtils.getAvatarUrl(raw)
  if (raw === undefined || raw === null) return AvatarUtils.getAvatarUrl('')
  return AvatarUtils.getAvatarUrl(String(raw))
}

const clearCall = () => {
  currentCall.value = null
}

const matchCurrentRoom = (payload: { roomId?: string }) => {
  if (!currentCall.value) return false
  if (!payload?.roomId) return true
  return payload.roomId === currentCall.value.roomId
}

const extractTargetIds = (payload: CallPayload) => {
  if (Array.isArray(payload.targetIds)) {
    return payload.targetIds.filter((id): id is string => typeof id === 'string')
  }
  if (typeof payload.targetUid === 'string') {
    return [payload.targetUid]
  }
  return []
}

const handleCallRequest = (payload: CallPayload) => {
  const myUid = userStore.userInfo?.uid
  if (!myUid) return

  const targets = extractTargetIds(payload)
  if (targets.length > 0 && !targets.includes(myUid)) {
    return
  }

  const callerUid = payload.callerUid || payload.callerId || payload.senderId
  const roomId = payload.roomId
  if (!callerUid || !roomId) return

  const callType = payload.isVideo || payload.video ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
  const remoteUserInfo = groupStore.getUserInfo(callerUid, roomId)
  const displayNameCandidate =
    remoteUserInfo?.myName ||
    remoteUserInfo?.name ||
    payload.callerName ||
    payload.name ||
    t('mobile_voice_video.unknown_user')
  const avatarCandidate = remoteUserInfo?.avatar ?? payload.avatar

  currentCall.value = {
    callerUid,
    roomId,
    callType,
    displayName: displayNameCandidate,
    avatar: toAvatarUrl(avatarCandidate)
  }
}

const handleCallEnd = (payload: { roomId?: string }) => {
  if (!currentCall.value) return
  if (!matchCurrentRoom(payload)) return
  clearCall()
}

const handleReject = async () => {
  const call = currentCall.value
  if (!call) return

  try {
    await sendMatrixVoipSignal('VIDEO_CALL_RESPONSE', {
      callerUid: call.callerUid,
      roomId: call.roomId,
      accepted: 'rejected'
    })
  } catch (error) {
    logger.error('发送拒绝响应失败:', error)
  } finally {
    clearCall()
  }
}

const handleAccept = async () => {
  const call = currentCall.value
  if (!call) return

  const query = {
    remoteUserId: call.callerUid,
    roomId: call.roomId,
    callType: String(call.callType),
    isIncoming: 'true',
    autoAccept: '1'
  } as const

  try {
    await router.push({ path: '/mobile/rtcCall', query })
  } catch (error) {
    logger.error('跳转通话页面失败:', error)
  } finally {
    clearCall()
  }
}

useMitt.on(MittEnum.MOBILE_RTC_CALL_REQUEST, handleCallRequest)
useMitt.on('CANCEL', handleCallEnd)
useMitt.on('DROPPED', handleCallEnd)
useMitt.on('TIMEOUT', handleCallEnd)
useMitt.on('CallRejected', handleCallEnd)
useMitt.on('CallAccepted', handleCallEnd)
useMitt.on('RoomClosed', handleCallEnd)
</script>

<style scoped lang="scss">
.rtc-call-card {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--tjg-surface-darkest) 95%, transparent),
    color-mix(in srgb, var(--tjg-surface-darkest) 92%, transparent)
  );
  backdrop-filter: blur(18px);
  border: 1px solid var(--tjg-border-contrast);
  border-radius: 18px;
  padding: 12px 16px;
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.34);
}

.avatar-shell {
  background: var(--tjg-border-contrast);
  border: 1px solid color-mix(in srgb, var(--tjg-text-inverse) 14%, transparent);
  backdrop-filter: blur(14px);
}

.rtc-action-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform 0.15s ease-out;

  &:active {
    transform: scale(0.95);
  }

  svg {
    pointer-events: none;
  }

  &.reject {
    background: color-mix(in srgb, var(--tjg-color-danger-500) 68%, transparent);
    box-shadow: 0 12px 26px color-mix(in srgb, var(--tjg-color-danger-500) 30%, transparent);
  }

  &.accept {
    background: color-mix(in srgb, var(--tjg-color-primary-500) 68%, transparent);
    box-shadow: 0 12px 26px var(--tjg-color-primary-300-alpha);
  }
}

.rtc-call-float-enter-active,
.rtc-call-float-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
}

.rtc-call-float-enter-from,
.rtc-call-float-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
