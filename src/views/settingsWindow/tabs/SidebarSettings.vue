<template>
  <div class="sidebar-settings">
    <div class="settings-section">
      <h3 class="section-title">布局</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示头像</span>
          <span class="setting-desc">在侧边栏列表项中显示用户头像</span>
        </div>
        <n-switch v-model:value="showAvatar" @update:value="handleLayoutToggle('showAvatar')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示折叠按钮</span>
          <span class="setting-desc">在侧边栏底部显示折叠/展开按钮</span>
        </div>
        <n-switch v-model:value="showCollapsed" @update:value="handleLayoutToggle('showCollapsed')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示拖拽手柄</span>
          <span class="setting-desc">允许拖拽调整侧边栏宽度</span>
        </div>
        <n-switch v-model:value="showDrag" @update:value="handleLayoutToggle('showDrag')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">仅显示图标</span>
          <span class="setting-desc">侧边栏仅显示图标，不显示文字</span>
        </div>
        <n-switch v-model:value="showIconsOnly" @update:value="handleLayoutToggle('showIconsOnly')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">显示内容</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示收藏夹</span>
          <span class="setting-desc">在侧边栏显示收藏的房间</span>
        </div>
        <n-switch v-model:value="showFavourites" @update:value="handleToggle('showFavourites')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示空间</span>
          <span class="setting-desc">在侧边栏显示空间列表</span>
        </div>
        <n-switch v-model:value="showSpaces" @update:value="handleToggle('showSpaces')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示房间</span>
          <span class="setting-desc">在侧边栏显示房间列表</span>
        </div>
        <n-switch v-model:value="showRooms" @update:value="handleToggle('showRooms')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示直接消息</span>
          <span class="setting-desc">在侧边栏显示私聊列表</span>
        </div>
        <n-switch v-model:value="showDirectMessages" @update:value="handleToggle('showDirectMessages')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示好友分组</span>
          <span class="setting-desc">在侧边栏显示好友分组列表</span>
        </div>
        <n-switch v-model:value="showFriends" @update:value="handleToggle('showFriends')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示活跃线程</span>
          <span class="setting-desc">在侧边栏显示活跃线程入口</span>
        </div>
        <n-switch v-model:value="showThreads" @update:value="handleToggle('showThreads')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">排序方式</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">房间排序</span>
          <span class="setting-desc">选择房间的排列顺序</span>
        </div>
        <n-select
          v-model:value="sortBy"
          :options="sortOptions"
          style="width: 150px"
          @update:value="handleSortChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">列表项大小</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">列表项大小</span>
          <span class="setting-desc">调整侧边栏列表项的显示大小</span>
        </div>
        <n-select
          v-model:value="itemSize"
          :options="itemSizeOptions"
          style="width: 120px"
          @update:value="handleItemSizeChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSwitch, NDivider, NSelect, useMessage } from 'naive-ui'

defineOptions({
  name: 'SidebarSettings'
})

const message = useMessage()

const STORAGE_KEY = 'hula-sidebar-settings'

const showFavourites = ref(true)
const showSpaces = ref(true)
const showRooms = ref(true)
const showDirectMessages = ref(true)
const showFriends = ref(true)
const showThreads = ref(true)
const showAvatar = ref(true)
const showCollapsed = ref(true)
const showDrag = ref(true)
const showIconsOnly = ref(false)
const sortBy = ref('activity')
const itemSize = ref('medium')

const sortOptions = [
  { label: '最近活动', value: 'activity' },
  { label: '按字母顺序', value: 'alphabetical' },
  { label: '手动排序', value: 'manual' }
]

const itemSizeOptions = [
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' }
]

onMounted(() => {
  loadSettings()
})

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.showFavourites !== undefined) showFavourites.value = settings.showFavourites
      if (settings.showSpaces !== undefined) showSpaces.value = settings.showSpaces
      if (settings.showRooms !== undefined) showRooms.value = settings.showRooms
      if (settings.showDirectMessages !== undefined) showDirectMessages.value = settings.showDirectMessages
      if (settings.showFriends !== undefined) showFriends.value = settings.showFriends
      if (settings.showThreads !== undefined) showThreads.value = settings.showThreads
      if (settings.showAvatar !== undefined) showAvatar.value = settings.showAvatar
      if (settings.showCollapsed !== undefined) showCollapsed.value = settings.showCollapsed
      if (settings.showDrag !== undefined) showDrag.value = settings.showDrag
      if (settings.showIconsOnly !== undefined) showIconsOnly.value = settings.showIconsOnly
      if (settings.sortBy) sortBy.value = settings.sortBy
      if (settings.itemSize) itemSize.value = settings.itemSize
    } catch {
      // ignore parse errors
    }
  }
}

function saveSettings() {
  const settings = {
    showFavourites: showFavourites.value,
    showSpaces: showSpaces.value,
    showRooms: showRooms.value,
    showDirectMessages: showDirectMessages.value,
    showFriends: showFriends.value,
    showThreads: showThreads.value,
    showAvatar: showAvatar.value,
    showCollapsed: showCollapsed.value,
    showDrag: showDrag.value,
    showIconsOnly: showIconsOnly.value,
    sortBy: sortBy.value,
    itemSize: itemSize.value
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function handleToggle(key: string) {
  saveSettings()
  const labelMap: Record<string, string> = {
    showFavourites: '收藏夹',
    showSpaces: '空间',
    showRooms: '房间',
    showDirectMessages: '直接消息',
    showFriends: '好友分组',
    showThreads: '活跃线程'
  }
  const label = labelMap[key] || key
  const stateMap: Record<string, boolean> = {
    showFavourites: showFavourites.value,
    showSpaces: showSpaces.value,
    showRooms: showRooms.value,
    showDirectMessages: showDirectMessages.value,
    showFriends: showFriends.value,
    showThreads: showThreads.value
  }
  message.success(stateMap[key] ? `已显示${label}` : `已隐藏${label}`)
}

function handleLayoutToggle(key: string) {
  saveSettings()
  const labelMap: Record<string, string> = {
    showAvatar: '头像',
    showCollapsed: '折叠按钮',
    showDrag: '拖拽手柄',
    showIconsOnly: '仅图标模式'
  }
  const label = labelMap[key] || key
  const stateMap: Record<string, boolean> = {
    showAvatar: showAvatar.value,
    showCollapsed: showCollapsed.value,
    showDrag: showDrag.value,
    showIconsOnly: showIconsOnly.value
  }
  message.success(stateMap[key] ? `已开启${label}` : `已关闭${label}`)
}

function handleSortChange(value: string) {
  sortBy.value = value
  saveSettings()
  message.success(`排序方式已更改为${sortOptions.find((o) => o.value === value)?.label}`)
}

function handleItemSizeChange(value: string) {
  itemSize.value = value
  saveSettings()
  message.success(`列表项大小已更改为${itemSizeOptions.find((o) => o.value === value)?.label}`)
}
</script>

<style scoped>
.sidebar-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}
</style>
