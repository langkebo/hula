import Colorthief from 'colorthief'
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixAccountService } from '@/services/matrix'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { mapUserStateToPresence } from '@/utils/userStatus'

const colorthief = new Colorthief()

// 状态图标颜色
const ensureStateColor = (state?: STO.UserState) => {
  if (!state || state.bgColor || !state.url) return

  const img = new Image()
  img.src = state.url
  img.onload = async () => {
    const colors = await colorthief.getColor(img, 3)
    state.bgColor = `rgba(${colors.join(',')}, 0.4)`
  }
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
