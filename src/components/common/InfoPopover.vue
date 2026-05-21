<template>
  <!-- 个人信息框 -->
  <n-flex vertical :size="26" class="size-fit box-border rounded-8px relative min-h-[260px] select-none cursor-default">
    <!-- 背景：使用中性图，避免依赖未实现的 wearingItemId 协议 -->
    <img
      class="absolute rounded-t-8px z-2 top-0 left-0 w-full h-100px object-cover"
      src="/img/dispersion-bg.png"
      alt="个人信息背景" />
    <div class="h-20px"></div>
    <n-flex vertical :size="20" class="size-full p-10px box-border z-10 relative">
      <n-flex vertical :size="20">
        <div class="avatar-wrapper relative" :class="{ 'cursor-pointer': isCurrentUserUid }" @click="openEditInfo">
          <div v-if="isCurrentUserUid" class="hover-area absolute top-8px left-8px w-80px h-80px rounded-full z-20">
            <div class="avatar-hover absolute inset-0 rounded-full"></div>
          </div>
          <n-avatar
            class="border-(8px solid [--avatar-border-color])"
            :bordered="true"
            round
            :size="80"
            :src="avatarSrc"
            :color="avatarColor"
            :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
        </div>

        <!-- 在线状态点 -->
        <template v-if="!statusIcon">
          <n-popover trigger="hover" placement="top" :show-arrow="false">
            <template #trigger>
              <div
                @click="
                  isCurrentUserUid
                    ? openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)
                    : void 0
                "
                class="z-30 absolute top-72px left-72px border-(6px solid [--avatar-border-color]) rounded-full size-18px"
                :class="[
                  displayActiveStatus === OnlineEnum.ONLINE
                    ? 'bg-[--hula-color-primary-500]'
                    : 'bg-[--hula-text-tertiary]',
                  isCurrentUserUid ? 'cursor-pointer' : 'cursor-default'
                ]"></div>
            </template>
            <span>
              {{
                displayActiveStatus === OnlineEnum.ONLINE
                  ? t('home.profile_card.status.online')
                  : t('home.profile_card.status.offline')
              }}
            </span>
          </n-popover>
        </template>

        <!-- 独立的状态图标 -->
        <template v-if="statusIcon">
          <n-popover trigger="hover" placement="top" :show-arrow="false">
            <template #trigger>
              <div class="z-30 absolute top-72px left-72px size-26px bg-[--avatar-border-color] rounded-full">
                <img
                  :src="statusIcon"
                  @click="
                    isCurrentUserUid
                      ? openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)
                      : void 0
                  "
                  class="p-4px rounded-full size-18px"
                  :class="isCurrentUserUid ? 'cursor-pointer' : 'cursor-default'"
                  :alt="currentStateTitle" />
              </div>
            </template>
            <span>{{ currentStateTitle }}</span>
          </n-popover>
        </template>

        <n-flex align="center" :size="8">
          <p
            class="text-(18px [--hula-text-secondary]) w-fit"
            :class="{ 'cursor-pointer text-underline': isCurrentUserUid }"
            @click="openEditInfo"
            style="
              font-weight: bold !important;
              font-family:
                system-ui,
                -apple-system,
                sans-serif;
            ">
            {{ displayName }}
          </p>
          <span v-if="groupNickname && groupNickname !== displayName" class="text-(13px [--hula-text-secondary])">
            ({{ groupNickname }})
          </span>
        </n-flex>

        <!-- 账号 -->
        <n-flex align="center" :size="10">
          <n-flex align="center" :size="12">
            <p class="text-[--info-text-color]">{{ t('home.profile_card.labels.account') }}</p>
            <span class="text-(12px [--hula-text-secondary])">{{ displayAccount }}</span>

            <n-tooltip trigger="hover">
              <template #trigger>
                <svg
                  class="size-12px cursor-pointer hover:color-[--hula-text-tertiary] hover:transition-colors"
                  @click="handleCopy">
                  <use href="#copy"></use>
                </svg>
              </template>
              <span>{{ t('home.profile_card.tooltip.copy_account') }}</span>
            </n-tooltip>
          </n-flex>
        </n-flex>
      </n-flex>

      <n-flex justify="center" align="center" :size="40">
        <n-button v-if="isCurrentUserUid" secondary type="info" @click="openEditInfo">
          {{ t('home.profile_card.buttons.edit') }}
        </n-button>
        <n-button v-else-if="isMyFriend" secondary type="primary" @click="handleOpenMsgSession(uid)">
          {{ t('home.profile_card.buttons.message') }}
        </n-button>
        <n-button v-else secondary @click="addFriend">{{ t('home.profile_card.buttons.add_friend') }}</n-button>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum, OnlineEnum, ThemeEnum } from '@/enums/index.ts'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMitt } from '@/hooks/useMitt'
import { leftHook } from '@/layout/left/hook'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { resolveDisplayActiveStatus } from '@/utils/presenceStatus'
import { toLocalpart } from '@/utils/userIdentity'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const { uid, activeStatus } = defineProps<{
  uid: string
  activeStatus?: OnlineEnum
}>()
const settingStore = useSettingStore()
const avatarColor = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '' : 'var(--hula-text-inverse)'))
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const chatStore = useChatStore()
const { openContent } = leftHook()
const contactStore = useContactStore()
const userStatusStore = useUserStatusStore()
const userStore = useUserStore()
const userUid = computed(() => userStore.userInfo?.uid ?? '')

/** 是否是当前登录的用户 */
const isCurrentUserUid = computed(() => userUid.value === uid)

/**
 * 解析当前 uid 的资料：优先 groupStore（房间内成员），
 * 若是自己且不在任何房间，则回退到 userStore.userInfo，
 * 否则再回退到 contactStore（好友列表）。
 * 之前直接用 groupStore.getUserInfo(uid)，自己一旦没有房间会全为空。
 */
const resolvedUserInfo = computed(() => {
  const fromGroup = groupStore.getUserInfo(uid)
  if (fromGroup) return fromGroup
  if (isCurrentUserUid.value && userStore.userInfo) return userStore.userInfo
  return contactStore.getContactByUserId?.(uid) ?? null
})

const avatarSrc = computed(() => AvatarUtils.getAvatarUrl((resolvedUserInfo.value?.avatar as string) || ''))

/** 显示用 displayName / account（带兜底，避免 null/MXID 直接外露）
 *  resolvedUserInfo 联合类型里 `displayName` 仅在 MatrixRoomMember 上存在，
 *  这里用 `as` 兜底类型差异。
 */
const displayName = computed(() => {
  const info = resolvedUserInfo.value as { name?: string; displayName?: string | null } | null
  return info?.name || info?.displayName || toLocalpart(uid) || uid
})
const displayAccount = computed(() => resolvedUserInfo.value?.account || toLocalpart(uid))

const { stateList } = storeToRefs(userStatusStore)

/** 是否是我的好友 */
const isMyFriend = computed(() => !!contactStore.contactsList.find((item) => item.uid === uid))
/** 是否为群聊 */
const isGroupChat = computed<boolean>(() => chatStore.isGroup)
/** 当前会话 roomId */
const currentRoomId = computed(() => globalStore.currentSessionRoomId)
/** 当前房间用户信息 */
const currentRoomUserInfo = computed(() => {
  if (!isGroupChat.value || !currentRoomId.value) return null
  return groupStore.getUserInfo(uid, currentRoomId.value) ?? null
})
/** 群昵称 */
const groupNickname = computed(() => {
  if (!currentRoomUserInfo.value) return ''
  const nickname = currentRoomUserInfo.value.myName?.trim()
  return nickname || ''
})
// 显示的在线状态
const displayActiveStatus = computed(() => {
  const fallback = isCurrentUserUid.value
    ? (resolvedUserInfo.value?.activeStatus ?? userStore.userInfo?.activeStatus)
    : resolvedUserInfo.value?.activeStatus
  return resolveDisplayActiveStatus(activeStatus, fallback)
})

// 计算当前用户状态图标
const statusIcon = computed(() => {
  const userStateId = (resolvedUserInfo.value as { userStateId?: string } | null)?.userStateId

  // 如果在线且有特殊状态
  if (userStateId && userStateId !== '1') {
    const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
    if (state) {
      return state.url
    }
  }
  return null
})

// 计算当前状态的标题
const currentStateTitle = computed(() => {
  const userStateId = (resolvedUserInfo.value as { userStateId?: string } | null)?.userStateId

  if (userStateId && userStateId !== '1') {
    const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
    if (state) {
      return state.title
    }
  }
  return displayActiveStatus.value === OnlineEnum.ONLINE
    ? t('home.profile_card.status.online')
    : t('home.profile_card.status.offline')
})

const openEditInfo = () => {
  if (isCurrentUserUid.value) {
    useMitt.emit(MittEnum.OPEN_EDIT_INFO)
  }
}

// 处理复制账号
const handleCopy = () => {
  const account = displayAccount.value
  if (account) {
    navigator.clipboard.writeText(account)
    showFeedback(t('home.profile_card.notification.copy_success', { account }), 'success')
  }
}

const addFriend = () => {
  useMitt.emit(MittEnum.OPEN_ADD_FRIEND_DIALOG, { uid })
}

let enableScroll = () => {}

const handleOpenMsgSession = async (uid: string) => {
  enableScroll() // 在打开新会话前恢复所有滚动
  await openMsgSession(uid)
}

onMounted(() => {
  // 注入 enableAllScroll 方法
  const popoverControls = inject('popoverControls', { enableScroll: () => {} })
  enableScroll = () => {
    if (typeof popoverControls.enableScroll === 'function') {
      popoverControls.enableScroll()
    }
  }
})
</script>

<style scoped lang="scss">
.avatar-wrapper {
  .hover-area {
    .avatar-hover {
      opacity: 0;
      transition: opacity 0.4s ease-in-out;
      background: var(--hula-overlay-mask-subtle);
      cursor: pointer;
    }
  }

  .hover-area:hover .avatar-hover {
    opacity: 1;
  }
}

.text-underline {
  &:hover {
    @apply cursor-pointer underline underline-offset-3 decoration-2 decoration-[--hula-text-secondary];
  }
}

.developer-cover {
  background: var(--hula-surface-panel-muted);
}
</style>
