/**
 * 编辑信息状态管理
 *
 * 替代 mitt 事件总线，解决响应式丢失问题
 *
 * 功能:
 * - 管理用户信息编辑弹窗状态
 * - 管理徽章列表和佩戴状态
 * - 保持响应式数据传递
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfoType, BadgeType } from '@/services/types'
import { IsYesEnum } from '@/enums'

export const useEditInfoStore = defineStore('editInfo', () => {
  const show = ref(false)
  const content = ref<Partial<UserInfoType>>({})
  const badgeList = ref<BadgeType[]>([])
  const loading = ref(false)

  const currentBadge = computed(() =>
    badgeList.value.find((item) => item.obtain === IsYesEnum.YES && item.wearing === IsYesEnum.YES)
  )

  const hasBadge = computed(() => badgeList.value.length > 0)

  function openEditInfo(data?: Partial<UserInfoType>) {
    content.value = data ? { ...data } : {}
    show.value = true
  }

  function closeEditInfo() {
    show.value = false
  }

  function toggleEditInfo(data?: Partial<UserInfoType>) {
    if (show.value) {
      closeEditInfo()
    } else {
      openEditInfo(data)
    }
  }

  function updateContent(data: Partial<UserInfoType>) {
    content.value = { ...content.value, ...data }
  }

  function setContent(data: Partial<UserInfoType>) {
    content.value = { ...data }
  }

  function clearContent() {
    content.value = {}
  }

  function setBadgeList(list: BadgeType[]) {
    badgeList.value = list.map((item) => ({ ...item }))
  }

  function wearBadge(badgeId: string) {
    badgeList.value = badgeList.value.map((item) => ({
      ...item,
      wearing: item.id === badgeId ? IsYesEnum.YES : IsYesEnum.NO
    }))
  }

  function unwearBadge() {
    badgeList.value = badgeList.value.map((item) => ({
      ...item,
      wearing: IsYesEnum.NO
    }))
  }

  function updateBadge(badgeId: string, updates: Partial<BadgeType>) {
    const index = badgeList.value.findIndex((item) => item.id === badgeId)
    if (index !== -1) {
      badgeList.value[index] = { ...badgeList.value[index], ...updates }
    }
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function reset() {
    show.value = false
    content.value = {}
    badgeList.value = []
    loading.value = false
  }

  return {
    show,
    content,
    badgeList,
    loading,
    currentBadge,
    hasBadge,
    openEditInfo,
    closeEditInfo,
    toggleEditInfo,
    updateContent,
    setContent,
    clearContent,
    setBadgeList,
    wearBadge,
    unwearBadge,
    updateBadge,
    setLoading,
    reset
  }
})
