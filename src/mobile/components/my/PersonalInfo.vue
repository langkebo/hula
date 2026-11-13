<template>
  <PersonalInfoHeader
    ref="headerRef"
    :user-detail-info="userDetailInfo"
    :friend-user-state="friendUserState"
    :current-state="currentState"
    :is-my-page="props.isMyPage"
    :show-skeleton="showSkeleton"
    :has-user-online-state="hasUserOnlineState"
    :is-show="props.isShow"
    :avatar-url="avatarUrl"
    @open-qr-code="toMyQRCode" />
  <!-- 个人描述与操作区 -->
  <Transition name="slide-fade" @before-enter="beforeEnter" @enter="enter" @leave="leave">
    <PersonalInfoActions
      v-if="props.isShow"
      :display-resume="displayResume"
      :loading="loading"
      :is-my-page="props.isMyPage"
      :is-my-friend-state="isMyFriendState"
      :is-bot="isBotUser(uid)"
      @edit-profile="toEditProfile"
      @delete-friend="handleDelete"
      @add-friend="handleAddFriend"
      @open-chat="toChatRoom" />
  </Transition>
</template>

<script setup lang="ts">
import { showDialog } from 'vant'
import { useRoute, useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import PersonalInfoActions from '@/mobile/components/my/PersonalInfoActions.vue'
import PersonalInfoHeader from '@/mobile/components/my/PersonalInfoHeader.vue'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import 'vant/es/dialog/style'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/composables/chat/useMessage'
import { OnlineEnum, UserType } from '@/enums'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import type { UserInfoType, UserItem } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'

const logger = createLogger('PersonalInfo')
const { showFeedback } = useActionFeedback()

const props = defineProps({
  isShow: {
    type: Boolean,
    default: true
  },
  isMyPage: {
    type: Boolean,
    default: true,
    require: false
  },
  isMyFriend: {
    type: Boolean,
    default: false,
    require: false
  }
})

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const userStatusStore = useUserStatusStore()
const groupStore = useGroupStore()
const route = useRoute()
const contactStore = useContactStore()
const globalStore = useGlobalStore()
const chatStore = useChatStore()

const { preloadChatRoom } = useMessage()
const uid = route.params.uid as string
const isMyFriendState = ref(props.isMyFriend)

const displayResume = computed(() => {
  const info = props.isMyPage ? userStore.userInfo : userDetailInfo.value
  if (info && 'resume' in info) {
    return info.resume ?? ''
  }
  return ''
})

const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

const toChatRoom = async () => {
  try {
    const res = await matrixSessionService.getSessionDetailWithFriends(uid)
    if (!res) {
      logger.error('Failed to get session detail')
      return
    }
    const existingSession = chatStore.getSession(res.roomId)
    if (!existingSession) {
      chatStore.updateSessionLastActiveTime(res.roomId)
      await chatStore.getSessionList(true)
    }
    await preloadChatRoom(res.roomId)
    router.push({ name: 'mobileChatMain', params: { roomId: res.roomId } })
  } catch (error) {
    logger.error('Failed to enter chat room for direct chat:', error)
  }
}

const handleAddFriend = async () => {
  globalStore.setAddFriendTarget(uid)
  router.push('/mobile/mobileFriends/confirmAddFriend')
}

const userDetailInfo = ref<UserItem | UserInfoType | undefined>({
  activeStatus: OnlineEnum.ONLINE,
  avatar: '',
  lastOptTime: 0,
  name: '',
  uid: '',
  account: '',
  resume: ''
})

const avatarUrl = computed(() => AvatarUtils.getAvatarUrl(userDetailInfo.value?.avatar || ''))

const friendUserState = ref<{ title: string; url: string; id?: string } | null>({
  title: '',
  url: ''
})

const hasUserOnlineState = ref(false)

const { stateList } = storeToRefs(userStatusStore)

const getUserState = (
  stateId: string
): {
  createBy: string
  createTime: number
  id: string
  title: string
  updateBy: null
  updateTime: null
  url: string
} => {
  const foundedState = stateList.value.find((state: { id: string }) => state.id === stateId)
  return foundedState
}

/**
 * 首屏骨架：昵称与账号都取不到时先渲染占位，避免昵称/账号闪空（方案 §8.5）。
 * 本人页数据来自持久化 store，通常同步可得；他人页来自群成员缓存，
 * 缓存未命中时由下方 watch 在数据到达后补渲染。
 */
const infoResolved = computed(() => Boolean(userDetailInfo.value?.name || userDetailInfo.value?.account))
/** 兜底：3s 后仍未取到数据就撤掉骨架，避免永久占位 */
const skeletonTimedOut = ref(false)
const showSkeleton = computed(() => !infoResolved.value && !skeletonTimedOut.value)

let skeletonTimer: ReturnType<typeof setTimeout> | undefined

function resolveUserDetail(): void {
  if (!uid) {
    userDetailInfo.value = userStore.userInfo
    return
  }

  const foundedUser = groupStore.allUserInfo.find((i) => i.uid === uid)

  if (foundedUser) {
    userDetailInfo.value = foundedUser
  }

  if (foundedUser?.userStateId && foundedUser?.userStateId !== '0') {
    const state = getUserState(foundedUser.userStateId)
    if (state) {
      friendUserState.value = state
      hasUserOnlineState.value = true
    }
  }

  const foundedFriend = contactStore.contactsList.find((item) => item.userId === uid)

  if (foundedFriend) {
    isMyFriendState.value = true
  }
}

onMounted(() => {
  resolveUserDetail()
  skeletonTimer = setTimeout(() => {
    skeletonTimedOut.value = true
  }, 3000)
})

// 数据晚于首屏到达（本人资料 / 群成员缓存）时补渲染并自动撤掉骨架
watch([() => groupStore.allUserInfo, () => userStore.userInfo], () => {
  if (infoResolved.value) return
  resolveUserDetail()
})

onUnmounted(() => {
  if (skeletonTimer) clearTimeout(skeletonTimer)
})

const currentState = computed(() => userStatusStore.currentState)

const loading = ref(false)

const handleDelete = () => {
  showDialog({
    title: t('mobile_personal_info.delete_friend_dialog.title'),
    message: t('mobile_personal_info.delete_friend_dialog.message'),
    showCancelButton: true,
    confirmButtonText: t('mobile_personal_info.delete_friend_dialog.confirm'),
    cancelButtonText: t('mobile_personal_info.delete_friend_dialog.cancel')
  })
    .then(async () => {
      if (userDetailInfo.value?.uid) {
        try {
          loading.value = true
          await contactStore.onDeleteFriend(userDetailInfo.value.uid)
          isMyFriendState.value = false
          chatStore.getSessionList(true)
          showFeedback(t('mobile_personal_info.delete_user.success'), 'success')
          router.back()
        } catch (error) {
          showFeedback(t('mobile_personal_info.delete_user.failed'), 'warning')
          logger.error('Failed to delete friend:', error)
        } finally {
          loading.value = false
        }
      } else {
        showFeedback(t('mobile_personal_info.not_found'), 'warning')
      }
    })
    .catch(() => {
      /* user cancelled dialog */
    })
}

const toEditProfile = () => {
  router.push('/mobile/mobileMy/editProfile')
}

const toMyQRCode = () => {
  router.push('/mobile/mobileMy/myQRCode')
}

function beforeEnter(el: Element) {
  const box = el as HTMLElement
  box.style.height = '0'
  box.style.opacity = '0'
  box.style.transform = 'translateY(-20px)'
}

function enter(el: Element, done: () => void) {
  const box = el as HTMLElement
  box.style.transition = 'all var(--tjg-motion-duration-slow) ease'
  requestAnimationFrame(() => {
    box.style.height = box.scrollHeight + 'px'
    box.style.opacity = '1'
    box.style.transform = 'translateY(0)'
  })

  box.addEventListener(
    'transitionend',
    () => {
      box.style.height = 'auto'
      done()
    },
    { once: true }
  )
}

function leave(el: Element, done: () => void) {
  const box = el as HTMLElement
  box.style.height = box.scrollHeight + 'px'
  box.style.opacity = '1'
  box.style.transform = 'translateY(0)'

  requestAnimationFrame(() => {
    box.style.transition = 'all var(--tjg-motion-duration-slow) ease'
    box.style.height = '0'
    box.style.opacity = '0'
    box.style.transform = 'translateY(-20px)'
  })

  box.addEventListener('transitionend', done, { once: true })
}

interface PersonalInfoHeaderExposed {
  avatarBox: HTMLElement | null
  infoBox: HTMLElement | null
}

const headerRef = ref<PersonalInfoHeaderExposed | null>(null)

watch(
  () => props.isShow,
  (show) => {
    const box = headerRef.value?.avatarBox
    if (!box) return

    box.style.overflow = 'hidden'
    box.style.transition = 'all var(--tjg-motion-duration-slow) ease'

    if (show) {
      box.style.height = box.scrollHeight + 'px'
      box.style.opacity = '1'
      box.style.transform = 'scale(1) translateY(0)'

      box.addEventListener(
        'transitionend',
        () => {
          box.style.height = 'auto'
          box.style.overflow = ''
        },
        { once: true }
      )
    } else {
      box.style.height = box.scrollHeight + 'px'
      requestAnimationFrame(() => {
        box.style.height = '58px'
        box.style.transform = 'scale(1) translateY(0)'
      })
    }
  }
)

watch(
  () => props.isShow,
  (show) => {
    const info = headerRef.value?.infoBox
    if (!info) return

    info.style.transition = 'transform var(--tjg-motion-duration-slow) ease'

    if (show) {
      info.style.transform = 'translateX(0)'
    } else {
      info.style.transform = 'translateX(-20px)'
    }
  }
)
</script>
<style lang="scss" scoped>
$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-chinese: 'PingFang SC', 'Hiragino Sans GB';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.medal-number {
  margin: 0 5px 0 3px;
  font-style: italic;
  font-weight: bolder;
  font-size: 1.25em;
  font-family: $font-family-system, $font-family-windows, $font-family-chinese, $font-family-sans;
}

.custom-rounded {
  border-top-left-radius: var(--tjg-radius-2xl);
  border-top-right-radius: var(--tjg-radius-2xl);
  overflow: hidden;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition:
    color var(--tjg-motion-duration-slow) ease,
    background-color var(--tjg-motion-duration-slow) ease,
    border-color var(--tjg-motion-duration-slow) ease,
    box-shadow var(--tjg-motion-duration-slow) ease,
    opacity var(--tjg-motion-duration-slow) ease,
    transform var(--tjg-motion-duration-slow) ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.slide-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.medal-fade-enter-active,
.medal-fade-leave-active {
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

.medal-fade-enter-from {
  max-height: 0;
  opacity: 0;
}

.medal-fade-enter-to {
  max-height: 24px;
  opacity: 1;
}

.medal-fade-leave-from {
  max-height: 24px;
  opacity: 1;
}

.medal-fade-leave-to {
  max-height: 0;
  opacity: 0;
}

.avatar-collapsible {
  transition:
    color var(--tjg-motion-duration-slow) ease,
    background-color var(--tjg-motion-duration-slow) ease,
    border-color var(--tjg-motion-duration-slow) ease,
    box-shadow var(--tjg-motion-duration-slow) ease,
    opacity var(--tjg-motion-duration-slow) ease,
    transform var(--tjg-motion-duration-slow) ease;
  transform-origin: top;
}
</style>
