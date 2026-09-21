// @ts-expect-error colorthief 3.x d.ts named exports not resolved by TS bundler mode; runtime works
import { getColor } from 'colorthief'
import { defineStore } from 'pinia'
import { OnlineEnum, StoresEnum } from '@/enums'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { mapUserStateToPresence, recordSentPresence, resolveOutgoingPresence } from '@/utils/userStatus'

const ensureStateColor = (state?: STO.UserState) => {
  if (!state || state.bgColor || !state.url) return

  const img = new Image()
  img.src = state.url
  img.onload = async () => {
    try {
      const color = await getColor(img)
      if (color) {
        state.bgColor = `rgba(${color.array().join(',')}, 0.4)`
      }
    } catch {
      // 颜色提取失败时保持默认背景,不产生 unhandled rejection
    }
  }
  img.onerror = () => {}
}

export const useUserStatusStore = defineStore(StoresEnum.USER_STATE, () => {
  /** 在线状态列表 */
  const stateList = ref<STO.UserState[]>([])

  const stateId = ref<string>('1')

  const currentState = computed(() => {
    const item = stateList.value.find((state: { id: string }) => state.id === stateId.value)

    if (!item) {
      const defaultItem = stateList.value.find((state: { id: string }) => state.id === '1')
      if (defaultItem) {
        ensureStateColor(defaultItem)
        return defaultItem
      }
    }

    if (item) {
      ensureStateColor(item)
    }
    return item as STO.UserState
  })

  watch(
    stateList,
    (list) => {
      list.forEach((state: STO.UserState) => ensureStateColor(state))
    },
    { immediate: true }
  )

  async function changeCurrentUserState(state: STO.UserState): Promise<void> {
    const userStore = useUserStore()
    const groupStore = useGroupStore()

    const targetPresence = mapUserStateToPresence(state)
    // 「允许其他用户看到您的在线状态」关闭时把在线选择降级为 offline（与状态菜单里的
    // 「离线」同语义），并把本地 activeStatus 一并置为离线，避免本地显示在线而对端看不到。
    // 其它状态（away/busy/隐身）是用户的显式选择，语义上本就不是「在线」，保持原行为。
    // 规则本身只在 utils/userStatus.resolveOutgoingPresence 里实现一份。
    const presence = resolveOutgoingPresence(targetPresence, useSettingStore().showOnlineStatusEnabled)
    const hidesOnline = presence !== targetPresence

    await matrixAccountService.setPresence(presence)
    // 记下最近成功上报的 presence，心跳据此判断是否还需要降级
    recordSentPresence(presence)

    stateId.value = state.id

    if (userStore.userInfo?.uid) {
      userStore.userInfo.userStateId = state.id
      if (hidesOnline) {
        userStore.userInfo.activeStatus = OnlineEnum.OFFLINE
      }
      groupStore.updateUserItem(userStore.userInfo.uid, {
        userStateId: state.id
      })
    }
  }

  return {
    stateList,
    stateId,
    currentState,
    changeCurrentUserState
  }
})
