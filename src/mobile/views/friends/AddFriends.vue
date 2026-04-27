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
            @clear="handleSearchClear">
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
                item-key="account"
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
                            settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'
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
                        :type="getVantButtonType(item)"
                        size="small"
                        class="action-button"
                        @click="handleButtonClick(item)">
                        {{ getButtonText(item) }}
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
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { useFriends, type FriendSearchResult } from '@/composables/useFriends'
import { ThemeEnum } from '@/enums'
import { RoomTypeEnum } from '@/enums/index.ts'
import { useBadgeStore } from '@/stores/domains/chat/badge'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMobile } from '@/utils/PlatformConstants'
import router from '@/router'

const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const badgeStore = useBadgeStore()
const tabs = ref([
  { name: 'recommend', label: '推荐' },
  { name: 'user', label: '找好友' },
  { name: 'group', label: '找群聊' }
])
const {
  searchType,
  searchValue,
  searchResults,
  hasSearched,
  loading,
  initialLoading,
  handleSearch,
  handleClear: clearSearch,
  handleTypeChange,
  initialize,
  getActionKind
} = useFriends()

const searchPlaceholder: Record<string, string> = {
  recommend: '输入推荐关键词',
  user: '输入昵称搜索好友',
  group: '输入群号搜索群聊'
}

const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  window.$message.success(`复制成功 ${account}`)
}

const handleSearchClear = () => {
  try {
    clearSearch()
  } catch (error) {
    window.$message.error('搜索失败')
  }
}

const getButtonText = (item: FriendSearchResult) => {
  const action = getActionKind(item)
  if (action === 'edit-profile') return '编辑资料'
  if (action === 'message') return '发消息'
  return '添加'
}

const getVantButtonType = (item: FriendSearchResult): 'default' | 'primary' | 'success' | 'warning' | 'danger' => {
  const action = getActionKind(item)
  if (action === 'edit-profile' || action === 'message') return 'default'
  return 'primary'
}

const handleButtonClick = (item: FriendSearchResult) => {
  const action = getActionKind(item)
  if (action === 'edit-profile') {
    handleEditProfile()
    return
  }

  if (action === 'message') {
    if (searchType.value === 'group') {
      handleSendGroupMessage(item)
    } else {
      handleSendMessage(item)
    }
    return
  }

  handleAddFriend(item)
}

const handleAddFriend = async (item: FriendSearchResult) => {
  if (searchType.value === 'user' || searchType.value === 'recommend') {
    globalStore.setAddFriendTarget(item.uid || '')

    router.push('/mobile/mobileFriends/confirmAddFriend')
  } else {
    globalStore.setAddGroupTarget({
      account: item.account,
      name: item.name,
      avatar: item.avatar
    })

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

const handleSendMessage = async (item: FriendSearchResult) => {
  emitTo('home', 'search_to_msg', { uid: item.uid, roomType: RoomTypeEnum.SINGLE })
}

const handleSendGroupMessage = async (item: FriendSearchResult) => {
  emitTo('home', 'search_to_msg', {
    uid: item.roomId,
    roomType: RoomTypeEnum.GROUP
  })
}

onMounted(async () => {
  await initialize()
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
