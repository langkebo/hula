<template>
  <!-- 个人信息框 -->
  <n-flex
    vertical
    :size="20"
    ref="rootEl"
    role="dialog"
    :aria-label="displayName"
    tabindex="-1"
    class="size-fit box-border rounded-8px relative min-h-[260px] select-none cursor-default outline-none">
    <!-- 背景：使用中性图，避免依赖未实现的 wearingItemId 协议 -->
    <img
      class="absolute rounded-t-8px z-2 top-0 left-0 w-full h-100px object-cover"
      src="/img/dispersion-bg.png"
      alt="" />

    <!-- 加载骨架 -->
    <template v-if="isLoading">
      <div class="flex items-center gap-12px px-10px z-10 relative">
        <div class="size-80px rounded-full bg-[--tjg-surface-subtle] animate-pulse"></div>
        <div class="flex flex-col gap-8px">
          <div class="w-120px h-16px rounded-4px bg-[--tjg-surface-subtle] animate-pulse"></div>
          <div class="w-80px h-12px rounded-4px bg-[--tjg-surface-subtle] animate-pulse"></div>
        </div>
      </div>
      <div class="flex flex-col gap-10px px-10px z-10 relative">
        <div class="w-full h-12px rounded-4px bg-[--tjg-surface-subtle] animate-pulse"></div>
        <div class="w-2/3 h-12px rounded-4px bg-[--tjg-surface-subtle] animate-pulse"></div>
      </div>
    </template>

    <!-- 加载失败且无任何本地资料 -->
    <template v-else-if="fetchError && !resolvedUserInfo">
      <div class="flex flex-col items-center gap-8px px-10px py-24px z-10 relative text-center">
        <p class="text-(14px [--tjg-text-secondary])">{{ t('home.profile_card.error.title') }}</p>
        <p class="text-(12px [--tjg-text-tertiary])">{{ t('home.profile_card.error.desc') }}</p>
      </div>
    </template>

    <template v-else>
      <n-flex vertical :size="20" class="size-full p-10px box-border z-10 relative">
        <!-- 头像 + 状态指示 -->
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
            :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :alt="displayName" />

          <!-- 自定义状态图标（离开/忙碌等业务态） -->
          <img
            v-if="statusIcon"
            :src="statusIcon"
            class="absolute top-72px left-72px size-26px rounded-full bg-[--avatar-border-color] p-4px z-30"
            :alt="presenceMeta.label" />
          <!-- 在线状态点 -->
          <div
            v-else
            class="z-30 absolute top-72px left-72px size-18px rounded-full border-(3px solid [--avatar-border-color])"
            :class="presenceMeta.colorClass"
            role="img"
            :aria-label="presenceMeta.label"></div>
        </div>

        <!-- 昵称 + 群昵称 -->
        <n-flex vertical :size="4">
          <n-flex align="center" :size="8">
            <p
              class="text-(18px [--tjg-text-secondary]) w-fit"
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
            <span v-if="groupNickname && groupNickname !== displayName" class="text-(13px [--tjg-text-secondary])">
              ({{ groupNickname }})
            </span>
          </n-flex>

          <!-- 在线状态文字语义 + 状态留言 + 最近活跃 -->
          <n-flex align="center" :size="6" class="flex-wrap">
            <span class="size-8px rounded-full shrink-0" :class="presenceMeta.colorClass"></span>
            <span class="text-(12px [--tjg-text-secondary])">{{ presenceMeta.label }}</span>
            <span v-if="statusMessage" class="text-(12px [--tjg-text-tertiary]) truncate max-w-[180px]">
              · {{ statusMessage }}
            </span>
          </n-flex>
          <p v-if="lastActiveText" class="text-(11px [--tjg-text-tertiary]) -mt-2px">{{ lastActiveText }}</p>

          <!-- 群角色 -->
          <n-flex v-if="roleLabel" align="center" :size="4" class="mt-2px">
            <span
              class="px-6px py-2px rounded-4px text-(11px [--tjg-text-secondary]) bg-[--tjg-surface-subtle] select-none">
              {{ roleLabel }}
            </span>
          </n-flex>
        </n-flex>

        <!-- 账号 + 复制 -->
        <n-flex align="center" :size="10">
          <p class="text-[--info-text-color]">{{ t('home.profile_card.labels.account') }}</p>
          <span class="text-(12px [--tjg-text-secondary]) break-all">{{ displayAccount }}</span>
          <n-tooltip trigger="hover">
            <template #trigger>
              <span
                class="flex items-center gap-4px cursor-pointer hover:color-[--tjg-text-tertiary] hover:transition-colors outline-none"
                role="button"
                tabindex="0"
                :aria-label="t('home.profile_card.tooltip.copy_account')"
                @click="handleCopy"
                @keydown.enter.prevent="handleCopy"
                @keydown.space.prevent="handleCopy">
                <svg v-if="!copied" class="size-12px"><use href="#copy"></use></svg>
                <svg v-else class="size-12px color-[--tjg-color-primary-500]"><use href="#success"></use></svg>
                <span v-if="copied" class="text-(11px [--tjg-color-primary-500])">
                  {{ t('home.profile_card.notification.copy_copied') }}
                </span>
              </span>
            </template>
            <span>
              {{
                copied ? t('home.profile_card.notification.copy_copied') : t('home.profile_card.tooltip.copy_account')
              }}
            </span>
          </n-tooltip>
        </n-flex>
        <span class="sr-only" aria-live="polite">
          {{ copied ? t('home.profile_card.notification.copy_copied') : '' }}
        </span>

        <!-- 扩展资料：性别 / 地区 / 个人简介 / 生日 -->
        <n-flex v-if="extendedRows.length" vertical :size="8" class="px-2px">
          <n-flex v-for="row in extendedRows" :key="row.label" align="flex-start" :size="10" class="w-full">
            <span class="text-(12px [--tjg-text-tertiary]) shrink-0 w-44px">{{ row.label }}</span>
            <span class="text-(12px [--tjg-text-secondary]) break-all">{{ row.value }}</span>
          </n-flex>
        </n-flex>

        <!-- 快捷操作 -->
        <n-flex justify="center" align="center" :size="12" class="flex-wrap">
          <n-button v-if="isCurrentUserUid" secondary type="info" @click="openEditInfo">
            {{ t('home.profile_card.buttons.edit') }}
          </n-button>
          <n-button v-else-if="isMyFriend" secondary type="primary" @click="handleOpenMsgSession(uid)">
            {{ t('home.profile_card.buttons.message') }}
          </n-button>
          <n-button v-else secondary @click="addFriend">{{ t('home.profile_card.buttons.add_friend') }}</n-button>
          <n-button v-if="!isCurrentUserUid && isGroupChat" secondary @click="handleMention">
            {{ t('home.profile_card.buttons.mention') }}
          </n-button>
        </n-flex>
      </n-flex>
    </template>
  </n-flex>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, inject, nextTick, onMounted, type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useClipboard } from '@/composables/common/useClipboard'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, OnlineEnum, SexEnum, ThemeEnum } from '@/enums/index.ts'
import { matrixPresenceService, type PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { toLocalpart } from '@/utils/userIdentity'
import { mapUserStateToPresence } from '@/utils/userStatus'

type PresenceKey = 'online' | 'away' | 'busy' | 'offline'

type FetchedProfile = {
  displayName?: string | null
  avatarUrl?: string | null
  sex?: number
  resume?: string
  region?: string
  birthday?: string
  displayBirthdayTag?: boolean
  displayAge?: boolean
  displayConstellation?: boolean
  presence?: PresenceState
  statusMessage?: string | null
  lastActiveAgo?: number
}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { write: writeClipboard } = useClipboard()

const { uid, activeStatus } = defineProps<{
  uid: string
  activeStatus?: OnlineEnum
}>()

const settingStore = useSettingStore()
const avatarColor = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '' : 'var(--tjg-text-inverse)'))
const globalStore = useGlobalStore()
const groupStore = useGroupStore()
const chatStore = useChatStore()
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
 */
const resolvedUserInfo = computed(() => {
  const fromGroup = groupStore.getUserInfo(uid)
  if (fromGroup) return fromGroup
  if (isCurrentUserUid.value && userStore.userInfo) return userStore.userInfo
  return contactStore.getContactByUserId?.(uid) ?? null
})

const avatarSrc = computed(() => {
  const f = fetched.value
  const storeAvatar = (resolvedUserInfo.value?.avatar as string) || ''
  const url = f?.avatarUrl || storeAvatar
  return AvatarUtils.getAvatarUrl(url)
})

const displayName = computed(() => {
  const f = fetched.value
  const info = resolvedUserInfo.value as { name?: string; displayName?: string | null } | null
  return f?.displayName || info?.name || info?.displayName || toLocalpart(uid) || uid
})
const displayAccount = computed(() => resolvedUserInfo.value?.account || toLocalpart(uid) || uid)

/* ----------------------------- 实时拉取（P0-2） ----------------------------- */
const isLoading = ref(false)
const fetchError = ref(false)
const fetched = ref<FetchedProfile | null>(null)

async function loadProfile() {
  isLoading.value = true
  fetchError.value = false
  try {
    const [baseRes, extRes, presenceRes] = await Promise.allSettled([
      profileService.getProfile(uid),
      profileService.getExtendedProfile(uid),
      matrixPresenceService.getPresence(uid)
    ])
    const base = baseRes.status === 'fulfilled' ? baseRes.value : null
    const ext = (extRes.status === 'fulfilled' ? extRes.value : null) as Record<string, unknown> | null
    const presence = presenceRes.status === 'fulfilled' ? presenceRes.value : null

    fetched.value = {
      displayName: base?.displayname ?? null,
      avatarUrl: base?.avatarUrl ?? null,
      sex: typeof ext?.sex === 'number' ? ext.sex : undefined,
      resume: typeof ext?.resume === 'string' ? ext.resume : undefined,
      region: typeof ext?.region === 'string' ? ext.region : undefined,
      birthday: typeof ext?.birthday === 'string' ? ext.birthday : undefined,
      displayBirthdayTag: ext?.displayBirthdayTag === true,
      displayAge: ext?.displayAge === true,
      displayConstellation: ext?.displayConstellation === true,
      presence: presence?.presence ?? undefined,
      statusMessage: presence?.status_msg ?? null,
      lastActiveAgo: typeof presence?.last_active_ago === 'number' ? presence.last_active_ago : undefined
    }

    const allFailed = baseRes.status === 'rejected' && extRes.status === 'rejected' && presenceRes.status === 'rejected'
    fetchError.value = allFailed
  } catch {
    fetchError.value = true
  } finally {
    isLoading.value = false
  }
}

/* ----------------------------- 在线状态（P0-3） ----------------------------- */
const { stateList } = storeToRefs(userStatusStore)

const presenceKey = computed<PresenceKey>(() => {
  const info = resolvedUserInfo.value as { userStateId?: string; activeStatus?: OnlineEnum } | null
  const userStateId = info?.userStateId

  if (userStateId && userStateId !== '1') {
    const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
    if (state) {
      const title = (state.title || '').toLowerCase()
      if (title.includes('busy') || title.includes('忙碌')) return 'busy'
      const mapped = mapUserStateToPresence(state)
      if (mapped === 'unavailable') return 'away'
      if (mapped === 'online') return 'online'
      return 'offline'
    }
  }

  const p = fetched.value?.presence
  if (p === 'online') return 'online'
  if (p === 'unavailable') return 'away'

  const fallback = info?.activeStatus ?? activeStatus
  return fallback === OnlineEnum.ONLINE ? 'online' : 'offline'
})

const presenceMeta = computed(() => {
  switch (presenceKey.value) {
    case 'online':
      return { colorClass: 'bg-[--tjg-color-primary-500]', label: t('home.profile_card.status.online') }
    case 'away':
      return { colorClass: 'bg-[--tjg-color-warning-400]', label: t('home.profile_card.status.away') }
    case 'busy':
      return { colorClass: 'bg-[--tjg-color-danger-500]', label: t('home.profile_card.status.busy') }
    default:
      return { colorClass: 'bg-[--tjg-text-tertiary]', label: t('home.profile_card.status.offline') }
  }
})

const statusMessage = computed(() => {
  const f = fetched.value?.statusMessage
  if (f) return f
  const contact = contactStore.getContactByUserId?.(uid)
  return (contact?.statusMessage as string | undefined) ?? null
})

/** 最近活跃时间戳（毫秒），用于展示"X 分钟前活跃" */
const lastActiveAgoMs = computed<number | undefined>(() => {
  const f = fetched.value
  if (typeof f?.lastActiveAgo === 'number' && f.lastActiveAgo > 0) return f.lastActiveAgo
  const lot = (resolvedUserInfo.value as { lastOptTime?: number } | null)?.lastOptTime
  if (typeof lot === 'number' && lot > 0) return Math.max(0, Date.now() - lot)
  return undefined
})

const lastActiveText = computed(() => {
  if (presenceKey.value === 'online') return ''
  const ago = lastActiveAgoMs.value
  if (!ago) return ''
  if (ago < 60_000) return t('home.profile_card.presence.activeNow')
  if (ago < 3_600_000) return t('home.profile_card.presence.activeMinutes', { minutes: Math.floor(ago / 60_000) })
  if (ago < 86_400_000) return t('home.profile_card.presence.activeHours', { hours: Math.floor(ago / 3_600_000) })
  return t('home.profile_card.presence.activeDays', { days: Math.floor(ago / 86_400_000) })
})

/* ----------------------------- 自定义状态图标 ----------------------------- */
const statusIcon = computed(() => {
  const userStateId = (resolvedUserInfo.value as { userStateId?: string } | null)?.userStateId
  if (userStateId && userStateId !== '1') {
    const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
    if (state?.url) return state.url
  }
  return null
})

/* ----------------------------- 群角色（P1-4） ----------------------------- */
const isGroupChat = computed<boolean>(() => chatStore.isGroup)
const currentRoomId = computed(() => globalStore.currentSessionRoomId)
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

const roleLabel = computed(() => {
  if (!isGroupChat.value || !currentRoomUserInfo.value) return ''
  if (groupStore.isCurrentLord(uid)) return t('home.chat_sidebar.roles.owner')
  if (groupStore.isAdmin(uid)) return t('home.chat_sidebar.roles.admin')
  return t('home.chat_sidebar.roles.member')
})

/* ----------------------------- 扩展资料（P0-1） ----------------------------- */
const sexLabel = computed(() => {
  const f = fetched.value
  const value = typeof f?.sex === 'number' ? f.sex : (resolvedUserInfo.value as { sex?: number } | null)?.sex
  if (value === SexEnum.MAN) return t('home.profile_card.labels.male')
  if (value === SexEnum.REMALE) return t('home.profile_card.labels.female')
  return ''
})

const birthdayDisplay = computed(() => {
  const f = fetched.value
  if (!f?.birthday) return ''
  const d = new Date(f.birthday)
  const valid = !Number.isNaN(d.getTime())
  const segs: string[] = []
  if (f.displayBirthdayTag && valid) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    segs.push(`${d.getFullYear()}-${mm}-${dd}`)
  }
  if (f.displayAge && valid) {
    const age = computeAge(d)
    if (age != null) segs.push(`${age}岁`)
  }
  if (f.displayConstellation && valid) {
    const c = computeConstellation(d)
    if (c) segs.push(c)
  }
  // 没有任何展示开关时，至少展示日期（用户已设置生日）
  if (segs.length === 0 && valid) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    segs.push(`${d.getFullYear()}-${mm}-${dd}`)
  }
  return segs.join(' · ')
})

const extendedRows = computed(() => {
  const f = fetched.value
  const rows: { label: string; value: string }[] = []
  if (sexLabel.value) rows.push({ label: t('home.profile_card.labels.sex'), value: sexLabel.value })
  if (f?.region) rows.push({ label: t('home.profile_card.labels.region'), value: f.region })
  if (f?.resume) rows.push({ label: t('home.profile_card.labels.bio'), value: f.resume })
  if (birthdayDisplay.value) rows.push({ label: t('home.profile_card.labels.birthday'), value: birthdayDisplay.value })
  return rows
})

function computeAge(d: Date): number | null {
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}

function computeConstellation(d: Date): string | null {
  const month = d.getMonth() + 1
  const day = d.getDate()
  const table: [number, number, string][] = [
    [1, 19, '摩羯座'],
    [2, 18, '水瓶座'],
    [3, 20, '双鱼座'],
    [4, 19, '白羊座'],
    [5, 20, '金牛座'],
    [6, 21, '双子座'],
    [7, 22, '巨蟹座'],
    [8, 22, '狮子座'],
    [9, 22, '处女座'],
    [10, 23, '天秤座'],
    [11, 22, '天蝎座'],
    [12, 21, '射手座'],
    [12, 31, '摩羯座']
  ]
  for (const [m, lastDay, name] of table) {
    if (month === m && day <= lastDay) return name
  }
  return null
}

/* ----------------------------- 是否为好友 / 操作 ----------------------------- */
const isMyFriend = computed(() => !!contactStore.contactsList.find((item) => item.uid === uid))

const openEditInfo = () => {
  if (isCurrentUserUid.value) {
    useMitt.emit(MittEnum.OPEN_EDIT_INFO)
  }
}

let enableScroll = () => {}

const handleOpenMsgSession = async (targetUid: string) => {
  enableScroll()
  await openMsgSession(targetUid)
}

const handleMention = () => {
  if (!isGroupChat.value || isCurrentUserUid.value) return
  useMitt.emit(MittEnum.AT, uid)
}

const addFriend = async () => {
  const { default: router } = await import('@/router')
  void router.push({ name: 'friend-add', query: { uid } })
}

/* ----------------------------- 复制账号（P2-10） ----------------------------- */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

const handleCopy = async () => {
  const account = displayAccount.value
  if (!account) return
  let ok = false
  try {
    await writeClipboard(account)
    ok = true
  } catch {
    ok = legacyCopy(account)
  }
  if (ok) {
    copied.value = true
    showFeedback(t('home.profile_card.notification.copy_success', { account }), 'success')
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 2000)
  }
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ----------------------------- 生命周期 / 焦点（P2-9） ----------------------------- */
const rootEl: Ref<HTMLElement | null> = ref(null)

onMounted(() => {
  const popoverControls = inject('popoverControls', { enableScroll: () => {} })
  enableScroll = () => {
    if (typeof popoverControls.enableScroll === 'function') {
      popoverControls.enableScroll()
    }
  }
  void loadProfile()
  nextTick(() => {
    const el = (rootEl.value as { $el?: HTMLElement } | null)?.$el ?? (rootEl.value as HTMLElement | null)
    if (el && typeof el.focus === 'function') el.focus()
  })
})
</script>

<style scoped lang="scss">
.avatar-wrapper {
  .hover-area {
    .avatar-hover {
      opacity: 0;
      transition: opacity 0.4s ease-in-out;
      background: var(--tjg-overlay-mask-subtle);
      cursor: pointer;
    }
  }

  .hover-area:hover .avatar-hover {
    opacity: 1;
  }
}

.text-underline {
  &:hover {
    @apply cursor-pointer underline underline-offset-3 decoration-2 decoration-[--tjg-text-secondary];
  }
}

.developer-cover {
  background: var(--tjg-surface-panel-muted);
}
</style>
