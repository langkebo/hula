import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { UserInfoType } from '@/services/types.ts'

export const useLoginHistoriesStore = defineStore(
  StoresEnum.LOGIN_HISTORY,
  () => {
    const loginHistories = ref<UserInfoType[]>([])

    const getLoginHistoryIndex = (loginHistory: UserInfoType) => {
      return loginHistories.value.findIndex((i) => i.account === loginHistory.account)
    }

    const addLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      if (index !== -1) {
        // 如果已存在，先删除旧的
        loginHistories.value.splice(index, 1)
      }
      // 添加到数组开头
      loginHistories.value.unshift(loginHistory)
    }

    const updateLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      index !== -1 && (loginHistories.value[index] = loginHistory)
    }

    const removeLoginHistory = (loginHistory: UserInfoType) => {
      const index = getLoginHistoryIndex(loginHistory)
      index !== -1 && loginHistories.value.splice(index, 1)
    }

    return { loginHistories, addLoginHistory, updateLoginHistory, removeLoginHistory }
  },
  {
    persist: {
      serializer: {
        serialize: (state: Record<string, unknown>) => {
          const sanitized = ((state.loginHistories || []) as Record<string, unknown>[]).map(
            ({ password: omittedP, phone: omittedPh, ...rest }: Record<string, unknown>) => {
              void omittedP
              void omittedPh
              return rest
            }
          )
          return JSON.stringify({ ...state, loginHistories: sanitized })
        },
        deserialize: JSON.parse
      }
    }
  }
)
