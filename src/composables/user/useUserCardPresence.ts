import { storeToRefs } from 'pinia'
import { type ComputedRef, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums/index.ts'
import { matrixPresenceService, type PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { isBusyUserStateTitle, mapUserStateToPresence } from '@/utils/userStatus'

export type PresenceKey = 'online' | 'away' | 'busy' | 'offline'

export type FetchedProfile = {
  displayName?: string | null
  avatarUrl?: string | null
  sex?: number | undefined
  resume?: string | undefined
  region?: string | undefined
  birthday?: string | undefined
  displayBirthdayTag?: boolean
  displayAge?: boolean
  displayConstellation?: boolean
  presence?: PresenceState | undefined
  statusMessage?: string | null
  lastActiveAgo?: number | undefined
}

type UserInfoLike = {
  userStateId?: string
  activeStatus?: OnlineEnum
  lastOptTime?: number
}

/**
 * 用户资料卡的「实时拉取 + 在线状态」逻辑。
 *
 * 从 `InfoPopover.vue` 抽出：资料拉取（三路 Promise.allSettled）与在线状态推导
 * （自定义状态优先 → 服务端 presence → 兜底 activeStatus）是纯数据逻辑，
 * 与弹层模板的展开/定位/点击交互无关，独立成 composable 后可单独测试。
 */
export function useUserCardPresence(params: {
  uid: string
  resolvedUserInfo: ComputedRef<unknown>
  activeStatus?: OnlineEnum | undefined
}) {
  const { t } = useI18n()
  const contactStore = useContactStore()
  const userStatusStore = useUserStatusStore()
  const { stateList } = storeToRefs(userStatusStore)

  const info = computed(() => (params.resolvedUserInfo.value as UserInfoLike | null) ?? null)

  const isLoading = ref(false)
  const fetchError = ref(false)
  const fetched = ref<FetchedProfile | null>(null)

  async function loadProfile(): Promise<void> {
    isLoading.value = true
    fetchError.value = false
    try {
      const [baseRes, extRes, presenceRes] = await Promise.allSettled([
        profileService.getProfile(params.uid),
        profileService.getExtendedProfile(params.uid),
        matrixPresenceService.getPresence(params.uid)
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

      const allFailed =
        baseRes.status === 'rejected' && extRes.status === 'rejected' && presenceRes.status === 'rejected'
      fetchError.value = allFailed
    } catch {
      fetchError.value = true
    } finally {
      isLoading.value = false
    }
  }

  const presenceKey = computed<PresenceKey>(() => {
    const current = info.value
    const userStateId = current?.userStateId

    if (userStateId && userStateId !== '1') {
      const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
      if (state) {
        if (isBusyUserStateTitle(state.title || '')) return 'busy'
        const mapped = mapUserStateToPresence(state)
        if (mapped === 'unavailable') return 'away'
        if (mapped === 'online') return 'online'
        return 'offline'
      }
    }

    const p = fetched.value?.presence
    if (p === 'online') return 'online'
    if (p === 'unavailable') return 'away'

    const fallback = current?.activeStatus ?? params.activeStatus
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
    const contact = contactStore.getContactByUserId?.(params.uid)
    return (contact?.statusMessage as string | undefined) ?? null
  })

  /** 最近活跃时间戳（毫秒），用于展示「X 分钟前活跃」。 */
  const lastActiveAgoMs = computed<number | undefined>(() => {
    const f = fetched.value
    if (typeof f?.lastActiveAgo === 'number' && f.lastActiveAgo > 0) return f.lastActiveAgo
    const lot = info.value?.lastOptTime
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

  /** 自定义状态图标 URL（未设置时返回 null）。 */
  const statusIcon = computed(() => {
    const userStateId = info.value?.userStateId
    if (userStateId && userStateId !== '1') {
      const state = stateList.value.find((s: { id: string }) => s.id === userStateId)
      if (state?.url) return state.url
    }
    return null
  })

  return {
    isLoading,
    fetchError,
    fetched,
    loadProfile,
    presenceKey,
    presenceMeta,
    statusMessage,
    lastActiveAgoMs,
    lastActiveText,
    statusIcon
  }
}
