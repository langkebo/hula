// @ts-expect-error colorthief 3.x d.ts uses named exports but TS resolves as export=; runtime works
import { getColor } from 'colorthief'
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { mapUserStateToPresence } from '@/utils/userStatus'

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

    await matrixAccountService.setPresence(mapUserStateToPresence(state))

    stateId.value = state.id

    if (userStore.userInfo?.uid) {
      userStore.userInfo.userStateId = state.id
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
