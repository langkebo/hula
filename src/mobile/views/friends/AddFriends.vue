<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="添加好友/群" />
    </template>

    <template #container>
      <div class="flex flex-col gap-14px">
        <!-- 搜索框 -->
        <div class="px-16px">
          <van-field
            v-model="searchValue"
            :placeholder="searchPlaceholder[searchType]"
            maxlength="20"
            clearable
            autocomplete="off"
            :spellcheck="false"
            autocorrect="off"
            autocapitalize="off"
            @keydown.enter="handleSearch"
            @clear="handleClear">
            <template #left-icon>
              <svg class="w-14px h-14px"><use href="#search" /></svg>
            </template>
          </van-field>
        </div>

        <!-- 搜索类型切换 -->
        <van-tabs v-model:active="searchType" animated shrink @update:active="handleTypeChange">
          <van-tab v-for="tab in tabs" :key="tab.name" :name="tab.name" :title="tab.label">
            <!-- 初始加载状态 -->
            <template v-if="initialLoading">
              <div class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)">
                <van-loading size="36px" />
              </div>
            </template>

            <!-- 搜索结果 -->
            <template v-else-if="searchResults.length">
              <FloatBlockList
                :data-source="searchResults"
                item-key="id"
                :item-height="64"
                max-height="calc(100vh / var(--page-scale, 1) - 128px)"
                style-id="search-hover-classes">
                <template #item="{ item }">
                  <div class="p-[0_20px] box-border">
                    <div class="flex items-center gap-12px p-[8px_0] rounded-lg">
                      <img
                        :src="AvatarUtils.getAvatarUrl(item.avatar)"
                        class="size-48px rounded-full object-cover"
                        @error="
                          ($event.target as HTMLImageElement).src =
                            themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'
                        " />
                      <div class="flex flex-col justify-center gap-10px flex-1">
                        <div class="flex items-center gap-10px">
                          <span class="text-(14px [--text-color])">{{ item.name }}</span>
                          <template v-for="account in item.itemIds" :key="account">
                            <img class="size-20px" :src="badgeStore.badgeById(account)?.img" alt="" />
                          </template>
                        </div>
                        <div class="flex items-center gap-10px">
                          <span class="text-(12px [--chat-text-color])">{{ `账号：${item.account}` }}</span>
                          <svg
                            class="size-12px hover:color-#909090 hover:transition-colors cursor-pointer"
                            @click="handleCopy(item.account)">
                            <use href="#copy"></use>
                          </svg>
                        </div>
                      </div>

                      <van-button
                        plain
                        :type="getVantButtonType(item.uid, item.roomId)"
                        size="small"
                        class="action-button"
                        @click="handleButtonClick(item)">
                        {{ getButtonText(item.uid, item.roomId) }}
                      </van-button>
                    </div>
                  </div>
                </template>
              </FloatBlockList>
            </template>

            <!-- 搜索中状态 -->
            <template v-else-if="loading">
              <div class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)">
                <van-loading size="36px" />
              </div>
            </template>

            <!-- 搜索无结果状态 -->
            <template v-else-if="hasSearched">
              <van-empty description="未找到相关结果" />
            </template>

            <!-- 默认空状态 -->
            <template v-else>
              <van-empty description="输入关键词搜索" image="search" />
            </template>
          </van-tab>
        </van-tabs>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { ThemeEnum } from '@/enums'
import { RoomTypeEnum } from '@/enums/index.ts'
import type { FriendItem } from '@/services/types'
import { useBadgeStore } from '@/stores/domains/chat/badge'
import { createLogger } from '@/utils/Logger'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { matrixContactService, type UserProfile } from '@/services/matrix'
import { matrixGroupService, type GroupSearchResult } from '@/services/matrix/MatrixGroupService'
import { isMobile } from '@/utils/PlatformConstants'
import router from '@/router'

const logger = createLogger('AddFriends')

interface SearchResult {
  uid?: string
  account: string
  name: string
  avatar: string
  itemIds?: string[] | null
  roomId?: string
  deleteStatus?: boolean
  extJson?: string
}

const contactStore = useContactStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const badgeStore = useBadgeStore()
const { themes } = storeToRefs(settingStore)
const tabs = ref([
  { name: 'recommend', label: '推荐' },
  { name: 'user', label: '找好友' },
  { name: 'group', label: '找群聊' }
])
const searchType = ref<string>('recommend')
const searchPlaceholder: Record<string, string> = {
  recommend: '输入推荐关键词',
  user: '输入昵称搜索好友',
  group: '输入群号搜索群聊'
}
const searchValue = ref('')
const searchResults = ref<SearchResult[]>([])
const hasSearched = ref(false)
const loading = ref(false)
const initialLoading = ref(true)

const getCachedUsers = (): SearchResult[] => {
  const users = groupStore.allUserInfo
  logger.debug('users:', users.length)

  return sortSearchResults(
    users
      .filter((user) => {
        const uid = user.uid as string
        return uid >= '20016' && uid <= '20030'
      })
      .map((user) => ({
        uid: user.uid,
        account: user.account,
        name: user.name,
        avatar: user.avatar,
        itemIds: user.itemIds || null
      })),
    'recommend'
  )
}

const clearSearchResults = () => {
  searchResults.value = []
  hasSearched.value = false
  searchValue.value = ''
}

const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  window.$message.success(`复制成功 ${account}`)
}

const handleClear = () => {
  clearSearchResults()

  if (searchType.value === 'recommend') {
    searchResults.value = getCachedUsers()
  }
}

const handleSearch = useDebounceFn(async () => {
  if (!searchValue.value.trim()) {
    if (searchType.value === 'recommend') {
      searchResults.value = getCachedUsers()
    }
    return
  }

  loading.value = true
  hasSearched.value = true

  try {
    if (searchType.value === 'group') {
      const res = await matrixGroupService.searchGroup(searchValue.value)
      searchResults.value = res.map((group: GroupSearchResult) => ({
        account: group.account,
        name: group.name,
        avatar: group.avatar || '',
        deleteStatus: !!group.deleteStatus,
        extJson: group.extJson,
        roomId: group.roomId
      }))
    } else if (searchType.value === 'user') {
      const res = await matrixContactService.searchFriend(searchValue.value)
      searchResults.value = res.map((user: UserProfile) => ({
        uid: user.userId,
        name: user.displayName || '',
        avatar: user.avatarUrl || '',
        account: user.userId
      }))
    } else {
      const cachedUsers = getCachedUsers()
      searchResults.value = cachedUsers.filter(
        (user) =>
          user?.name?.includes(searchValue.value) || (user.uid && user.uid.toString().includes(searchValue.value))
      )
    }
    searchResults.value = sortSearchResults(searchResults.value, searchType.value)
  } catch (error) {
    window.$message.error('搜索失败')
    searchResults.value = []
  } finally {
    loading.value = false
  }
}, 300)

const handleTypeChange = () => {
  clearSearchResults()

  if (searchType.value === 'recommend') {
    searchResults.value = getCachedUsers()
  }
}
const groupStore = useGroupStore()
const isInGroup = (roomId: string) => {
  return groupStore.groupDetails.some((group) => group.roomId === roomId)
}

const sortSearchResults = (items: SearchResult[], type: string) => {
  if (type === 'group') {
    return items.sort((a, b) => {
      const aInGroup = isInGroup(a.roomId || '')
      const bInGroup = isInGroup(b.roomId || '')
      if (aInGroup && !bInGroup) return -1
      if (!aInGroup && bInGroup) return 1
      return 0
    })
  } else {
    return items.sort((a, b) => {
      const aUid = String(a.uid || '')
      const bUid = String(b.uid || '')

      if (isCurrentUser(aUid)) return -1
      if (isCurrentUser(bUid)) return 1

      const aIsFriend = isFriend(aUid)
      const bIsFriend = isFriend(bUid)
      if (aIsFriend && !bIsFriend) return -1
      if (!aIsFriend && bIsFriend) return 1

      return 0
    })
  }
}

const isFriend = (uid: string) => {
  return contactStore.contactsList.some((contact: FriendItem) => contact.uid === uid)
}

const isCurrentUser = (uid: string) => {
  return userStore.userInfo!.uid === uid
}

const getButtonText = (uid: string, roomId: string) => {
  if (searchType.value === 'group') {
    return isInGroup(roomId) ? '发消息' : '添加'
  }
  if (isCurrentUser(uid)) return '编辑资料'
  if (isFriend(uid)) return '发消息'
  return '添加'
}

const getVantButtonType = (uid: string, roomId: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' => {
  if (searchType.value === 'group') {
    return isInGroup(roomId) ? 'default' : 'primary'
  }
  if (isCurrentUser(uid)) return 'default'
  if (isFriend(uid)) return 'default'
  return 'primary'
}

const handleButtonClick = (item: SearchResult) => {
  if (searchType.value === 'group') {
    if (item.roomId && isInGroup(item.roomId)) {
      handleSendGroupMessage(item)
    } else {
      handleAddFriend(item)
    }
    return
  }

  if (item.uid && isCurrentUser(item.uid)) {
    handleEditProfile()
  } else if (item.uid && isFriend(item.uid)) {
    handleSendMessage(item)
  } else {
    handleAddFriend(item)
  }
}

const handleAddFriend = async (item: SearchResult) => {
  if (searchType.value === 'user' || searchType.value === 'recommend') {
    globalStore.addFriendModalInfo.uid = item.uid || ''

    router.push('/mobile/mobileFriends/confirmAddFriend')
  } else {
    globalStore.addGroupModalInfo.account = item.account
    globalStore.addGroupModalInfo.name = item.name
    globalStore.addGroupModalInfo.avatar = item.avatar

    router.push('/mobile/mobileFriends/confirmAddGroup')
  }
}

const handleEditProfile = async () => {
  if (!isMobile()) {
    const homeWindow = await WebviewWindow.getByLabel('home')
    await homeWindow?.setFocus()
  }
  emitTo('home', 'open_edit_info')
}

const handleSendMessage = async (item: SearchResult) => {
  emitTo('home', 'search_to_msg', { uid: item.uid, roomType: RoomTypeEnum.SINGLE })
}

const handleSendGroupMessage = async (item: SearchResult) => {
  emitTo('home', 'search_to_msg', {
    uid: item.roomId,
    roomType: RoomTypeEnum.GROUP
  })
}

onMounted(async () => {
  try {
    await contactStore.getContactList(true)

    const cachedUsers = getCachedUsers()

    if (searchType.value === 'recommend') {
      searchResults.value = cachedUsers
    }
  } finally {
    initialLoading.value = false
  }
})
</script>

<style scoped lang="scss">
.action-button {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.9;
}

.action-button:hover {
  opacity: 1;
  transform: scale(1.06);
  box-shadow: 0 2px 8px rgba(var(--primary-color-rgb), 0.25);
}

.action-button:active {
  transform: scale(0.98);
}

:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-tab__panel) {
  padding: 0;
}
</style>
