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
            <div class="mt-4px text-12px text-white/70 truncate">{{ callMessage }}</div>
          </div>

          <div class="flex items-center gap-18px">
            <div v-clickable class="rtc-action-button reject" @click="handleReject">
              <svg class="size-20px color-[--tjg-text-inverse]">
                <use href="#PhoneHangup"></use>
              </svg>
            </div>

            <div v-clickable class="rtc-action-button accept" @click="handleAccept">
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
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMobileStore } from '@/stores/domains/settings/mobile'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RtcCallFloatCell')

const router = useRouter()
const mobileStore = useMobileStore()
const groupStore = useGroupStore()
const { t } = useI18n()

const currentCall = ref<{
  callId: string
  callerUid: string
  roomId: string
  callType: CallTypeEnum
  displayName: string
  avatar: string
} | null>(null)

let unsubscribeCallUpdate: (() => void) | null = null

const topOffset = computed(() => {
  const safeTop = mobileStore.safeArea.top
  const base = safeTop > 0 ? safeTop + 16 : 16
  return `${base}px`
})

const isVisible = computed(() => currentCall.value !== null)

const avatarUrl = computed(() => currentCall.value?.avatar ?? AvatarUtils.getAvatarUrl(''))

const displayName = computed(() => currentCall.value?.displayName || t('mobile_voice_video.unknown_user'))

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
  unsubscribeCallUpdate?.()
  unsubscribeCallUpdate = null
  currentCall.value = null
}

const handleIncomingCall = (info: CallInfo) => {
  const callerUid = info.participants?.[0]?.userId ?? ''
  if (!info.callId || !info.roomId || !callerUid) return

  // 已在通话页说明本机忙线，第二路来电必须立即拒绝，否则会一直响铃
  if (router.currentRoute.value.path === '/mobile/rtcCall') {
    void matrixVoIPService.rejectCall(info.callId).catch((error) => {
      logger.warn('Failed to reject incoming call while busy:', error)
    })
    return
  }

  clearCall()
  const remoteUserInfo = groupStore.getUserInfo(callerUid, info.roomId)
  currentCall.value = {
    callId: info.callId,
    callerUid,
    roomId: info.roomId,
    callType: info.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO,
    displayName:
      remoteUserInfo?.myName ||
      remoteUserInfo?.name ||
      info.participants[0]?.displayName ||
      t('mobile_voice_video.unknown_user'),
    avatar: toAvatarUrl(remoteUserInfo?.avatar ?? info.participants[0]?.avatarUrl)
  }

  unsubscribeCallUpdate = matrixVoIPService.onCallUpdate(info.callId, (update) => {
    if (update.state === 'ended' || update.state === 'error') clearCall()
  })
}

const handleReject = async () => {
  const call = currentCall.value
  if (!call) return
  try {
    await matrixVoIPService.rejectCall(call.callId)
  } catch (error) {
    logger.error('Failed to reject incoming call:', error)
  } finally {
    clearCall()
  }
}

const handleAccept = async () => {
  const call = currentCall.value
  if (!call) return

  const query = {
    callId: call.callId,
    remoteUserId: call.callerUid,
    roomId: call.roomId,
    callType: String(call.callType),
    isIncoming: 'true'
  } as const

  try {
    await router.push({ path: '/mobile/rtcCall', query })
    clearCall()
  } catch (error) {
    // 跳转失败时保留浮层，用户可重试接听
    logger.error('Failed to navigate to call page:', error)
  }
}

useMitt.on(MittEnum.MOBILE_VOIP_INCOMING_CALL, handleIncomingCall)
onUnmounted(clearCall)
</script>

<style scoped lang="scss">
.rtc-call-card {
  background: var(--tjg-surface-darkest);

  @supports (color: color-mix(in srgb, red, blue)) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--tjg-surface-darkest) 95%, transparent),
      color-mix(in srgb, var(--tjg-surface-darkest) 92%, transparent)
    );
  }

  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-medium));
  backdrop-filter: blur(var(--tjg-glass-blur-medium));
  border: 1px solid var(--tjg-border-contrast);
  border-radius: var(--tjg-radius-panel);
  padding: 12px 16px;
  box-shadow: var(--tjg-shadow-call-float);

  /* 低性能设备关闭实时模糊，半透明底色仍保证可读 */
  html.low-perf & {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

.avatar-shell {
  background: var(--tjg-border-contrast);
  border: 1px solid var(--tjg-surface-inverse-hover);

  @supports (color: color-mix(in srgb, red, blue)) {
    border: 1px solid color-mix(in srgb, var(--tjg-text-inverse) 14%, transparent);
  }

  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-soft));

  html.low-perf & {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

.rtc-action-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: transform var(--tjg-motion-duration-fast) ease-out;

  &:active {
    transform: scale(0.95);
  }

  svg {
    pointer-events: none;
  }

  &.reject {
    background: var(--tjg-color-danger-500);
    box-shadow: none;

    @supports (color: color-mix(in srgb, red, blue)) {
      background: color-mix(in srgb, var(--tjg-color-danger-500) 68%, transparent);
      box-shadow: 0 12px 26px color-mix(in srgb, var(--tjg-color-danger-500) 30%, transparent);
    }
  }

  &.accept {
    background: var(--tjg-color-primary-500);

    @supports (color: color-mix(in srgb, red, blue)) {
      background: color-mix(in srgb, var(--tjg-color-primary-500) 68%, transparent);
    }

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
