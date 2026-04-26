<template>
  <div class="h-full w-full bg-[--center-bg-color] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 标题 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(13px [--text-color]) select-none cursor-default"
      data-tauri-drag-region>
      {{ t('home.search_window.title') }}
    </p>

    <!-- 主要内容 -->
    <n-flex vertical :size="14" class="p-[45px_0_18px]" data-tauri-drag-region>
      <!-- 搜索框 -->
      <div class="px-12px">
        <n-input
          v-model:value="searchValue"
          type="text"
          size="small"
          style="border-radius: 8px; border: 1px solid #ccc"
          :placeholder="searchPlaceholder[searchType]"
          :maxlength="20"
          round
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable
          @keydown.enter="handleSearch"
          @clear="handleSearchClear">
          <template #prefix>
            <n-icon>
              <svg class="icon" aria-hidden="true">
                <use href="#search" />
              </svg>
            </n-icon>
          </template>
        </n-input>
      </div>

      <!-- 搜索类型切换 -->
      <n-tabs v-model:value="searchType" animated size="small" @update:value="handleTypeChange">
        <n-tab-pane v-for="tab in tabs" :key="tab.name" :name="tab.name" :tab="tab.label">
          <template>
            <span>{{ tab.label }}</span>
          </template>

          <!-- 初始加载状态 -->
          <template v-if="initialLoading">
            <n-spin class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)" size="large" />
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
                  <n-flex align="center" :size="12" class="p-[8px_0] rounded-lg">
                    <n-avatar
                      :size="48"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      :color="themes.content === ThemeEnum.DARK ? '' : '#fff'"
                      :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                      round />
                    <n-flex vertical justify="center" :size="10" class="flex-1">
                      <n-space align="center" :size="10">
                        <span class="text-(14px [--text-color])">{{ item.name }}</span>
                        <svg v-if="item.isFavorite" class="size-14px color-#f0a020">
                          <use href="#star"></use>
                        </svg>
                        <template v-for="account in item.itemIds" :key="account">
                          <img class="size-20px" :src="badgeStore.badgeById(account)?.img" alt="" />
                        </template>
                      </n-space>
                      <n-flex align="center" :size="10">
                        <span class="text-(12px [--chat-text-color])">
                          {{ t('home.search_window.labels.account', { account: item.account }) }}
                        </span>
                        <n-tooltip trigger="hover">
                          <template #trigger>
                            <svg
                              class="size-12px hover:color-[--color-text-tertiary] hover:transition-colors"
                              @click="handleCopy(item.account)">
                              <use href="#copy"></use>
                            </svg>
                          </template>
                          <span>{{ t('home.search_window.tooltip.copy_account') }}</span>
                        </n-tooltip>
                      </n-flex>
                    </n-flex>

                    <!-- 三种状态的按钮 -->
                    <n-button
                      secondary
                      :type="getButtonType(item)"
                      size="small"
                      class="action-button"
                      @click="handleButtonClick(item)">
                      {{ getButtonText(item) }}
                    </n-button>
                  </n-flex>
                </div>
              </template>
            </FloatBlockList>
          </template>

          <!-- 搜索中状态 -->
          <template v-else-if="loading">
            <n-spin class="flex-center" style="height: calc(100vh / var(--page-scale, 1) - 200px)" size="large" />
          </template>

          <!-- 搜索无结果状态 -->
          <template v-else-if="hasSearched">
            <n-empty
              class="flex-center"
              style="height: calc(100vh / var(--page-scale, 1) - 200px)"
              :description="t('home.search_window.empty.no_result')" />
          </template>

          <!-- 默认空状态 -->
          <template v-else>
            <n-empty
              style="height: calc(100vh / var(--page-scale, 1) - 200px)"
              class="flex-center"
              :description="t('home.search_window.empty.prompt')">
              <template #icon>
                <n-icon>
                  <svg><use href="#explosion"></use></svg>
                </n-icon>
              </template>
            </n-empty>
          </template>
        </n-tab-pane>
      </n-tabs>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import FloatBlockList from '@/components/common/FloatBlockList.vue'
import { useFriends, type FriendSearchResult } from '@/composables/useFriends'
import { ThemeEnum } from '@/enums'
import { RoomTypeEnum } from '@/enums/index.ts'
import { useWindow } from '@/hooks/useWindow'
import { useBadgeStore } from '@/stores/domains/chat/badge'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { createWebviewWindow } = useWindow()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const badgeStore = useBadgeStore()
const { themes } = storeToRefs(settingStore)

// 定义标签页
const { t } = useI18n()
const tabs = computed(() => [
  { name: 'recommend', label: t('home.search_window.tabs.recommend') },
  { name: 'user', label: t('home.search_window.tabs.user') },
  { name: 'group', label: t('home.search_window.tabs.group') }
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
// 搜索类型对应的placeholder映射
const searchPlaceholder = computed(() => ({
  recommend: t('home.search_window.placeholder.recommend'),
  user: t('home.search_window.placeholder.user'),
  group: t('home.search_window.placeholder.group')
}))

// 处理复制账号
const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  window.$message.success(t('home.search_window.notification.copy_success', { account }))
}

// 处理清空按钮点击
const handleSearchClear = () => {
  try {
    clearSearch()
  } catch (error) {
    window.$message.error(t('home.search_window.notification.search_fail'))
  }
}

// 获取按钮文本
const getButtonText = (item: FriendSearchResult) => {
  const action = getActionKind(item)
  if (action === 'edit-profile') {
    return t('home.search_window.buttons.edit_profile')
  }
  if (action === 'message') {
    return t('home.search_window.buttons.message')
  }
  return t('home.search_window.buttons.add')
}

// 获取按钮类型
const getButtonType = (item: FriendSearchResult) => {
  const action = getActionKind(item)
  if (action === 'edit-profile') return 'default'
  if (action === 'message') return 'info'
  return 'primary'
}

// 处理按钮点击
const handleButtonClick = (item: FriendSearchResult) => {
  const action = getActionKind(item)
  if (action === 'edit-profile') {
    handleEditProfile()
  } else if (action === 'message') {
    if (searchType.value === 'group') {
      handleSendGroupMessage(item)
    } else {
      handleSendMessage(item)
    }
  } else {
    handleAddFriend(item)
  }
}

// 处理添加好友或群聊
const handleAddFriend = async (item: FriendSearchResult) => {
  if (searchType.value === 'user' || searchType.value === 'recommend') {
    await createWebviewWindow(
      t('home.search_window.modal.add_friend'),
      'addFriendVerify',
      380,
      300,
      '',
      false,
      380,
      300
    )
    globalStore.addFriendModalInfo.show = true
    globalStore.addFriendModalInfo.uid = item.uid
  } else {
    await createWebviewWindow(t('home.search_window.modal.add_group'), 'addGroupVerify', 380, 400, '', false, 380, 400)
    globalStore.addGroupModalInfo.show = true
    globalStore.addGroupModalInfo.account = item.account
    globalStore.addGroupModalInfo.name = item.name
    globalStore.addGroupModalInfo.avatar = item.avatar
  }
}

// 处理编辑个人资料
const handleEditProfile = async () => {
  // 获取主窗口
  const homeWindow = await WebviewWindow.getByLabel('home')
  // 激活主窗口
  await homeWindow?.setFocus()
  // 打开个人资料编辑窗口
  emitTo('home', 'open_edit_info')
}

// 处理发送消息
const handleSendMessage = async (item: FriendSearchResult) => {
  const uid = String(item.uid || '')
  emitTo('home', 'search_to_msg', { uid, roomType: RoomTypeEnum.SINGLE })
}

// 处理发送群消息
const handleSendGroupMessage = async (item: FriendSearchResult) => {
  emitTo('home', 'search_to_msg', {
    uid: item.roomId,
    roomType: RoomTypeEnum.GROUP
  })
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
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

/* 移除标签内容的内边距 */
:deep(.n-tab-pane) {
  padding: 0 !important;
}

:deep(.n-tabs .n-tabs-nav-scroll-wrapper) {
  padding: 0 20px 10px !important;
}
</style>
