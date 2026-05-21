import { ref } from 'vue'
import type { UserInfoType } from '@/services/types'

export interface MatrixUserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  presence?: string
  statusMessage?: string
}

const userInfo = ref<UserInfoType | undefined>()
const matrixProfile = ref<MatrixUserProfile | null>(null)

export function useCurrentUserState() {
  return {
    userInfo,
    matrixProfile
  }
}

export function getCurrentUserInfo(): UserInfoType | undefined {
  return userInfo.value
}

export function setCurrentUserInfo(info: UserInfoType | undefined): UserInfoType | undefined {
  userInfo.value = info
  return userInfo.value
}

export function patchCurrentUserInfoFields(
  fields: Partial<Pick<UserInfoType, 'name' | 'avatar' | 'activeStatus' | 'lastOptTime'>>
): UserInfoType | undefined {
  if (!userInfo.value) {
    return undefined
  }

  if (fields.name !== undefined) userInfo.value.name = fields.name
  if (fields.avatar !== undefined) userInfo.value.avatar = fields.avatar
  if (fields.activeStatus !== undefined) userInfo.value.activeStatus = fields.activeStatus
  if (fields.lastOptTime !== undefined) userInfo.value.lastOptTime = fields.lastOptTime

  return userInfo.value
}

export function setCurrentMatrixProfile(profile: MatrixUserProfile | null): MatrixUserProfile | null {
  matrixProfile.value = profile
  return matrixProfile.value
}

export function clearCurrentUserState(): void {
  userInfo.value = undefined
  matrixProfile.value = null
}

export function resetCurrentUserStateForTests(): void {
  clearCurrentUserState()
}
