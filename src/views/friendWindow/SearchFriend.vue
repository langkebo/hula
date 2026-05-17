<template>
  <div class="h-full w-full bg-[--hula-surface-app] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 标题 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(13px [--hula-text-primary]) select-none cursor-default"
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
          style="border-radius: 8px; border: 1px solid var(--hula-border-default)"
          :placeholder="currentSearchPlaceholder"
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
                      :color="avatarColor"
                      :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                      round />
                    <n-flex vertical justify="center" :size="10" class="flex-1">
                      <n-space align="center" :size="10">
                        <span class="text-(14px [--hula-text-primary])">{{ item.name }}</span>
                      </n-space>
                      <n-flex align="center" :size="10">
                        <span class="text-(12px [--hula-text-secondary])">
                          {{ t('home.search_window.labels.account', { account: item.account }) }}
                        </span>
                        <n-tooltip trigger="hover">
                          <template #trigger>
                            <svg
                              class="size-12px hover:color-[--hula-text-tertiary] hover:transition-colors"
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
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type FriendSearchResult, useFriends } from '@/composables/useFriends'
import { RoomTypeEnum, ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const avatarColor = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '' : 'var(--hula-text-inverse)'))

// 定义标签页
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const tabs = computed(() => [
  { name: 'recommend', label: t('home.search_window.tabs.recommend') },
  { name: 'user', label: t('home.search_window.tabs.user') }
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
  user: t('home.search_window.placeholder.user')
}))
const currentSearchPlaceholder = computed(() =>
  searchType.value === 'user' ? searchPlaceholder.value.user : searchPlaceholder.value.recommend
)

// 处理复制账号
const handleCopy = (account: string) => {
  navigator.clipboard.writeText(account)
  showFeedback(t('home.search_window.notification.copy_success', { account }), 'success')
}

// 处理清空按钮点击
const handleSearchClear = () => {
  try {
    clearSearch()
  } catch (error) {
    showFeedback(t('home.search_window.notification.search_fail'), 'error')
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
    handleSendMessage(item)
  } else {
    handleAddFriend(item)
  }
}

// 处理添加好友
const handleAddFriend = async (item: FriendSearchResult) => {
  globalStore.openAddFriendModal(item.uid)
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
  box-shadow: 0 2px 8px color-mix(in srgb, var(--hula-color-primary-500) 25%, transparent);
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
