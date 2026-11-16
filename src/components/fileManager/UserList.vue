<template>
  <div
    v-show="shouldShowUserList"
    class="w-240px flex-shrink-0 flex flex-col bg-[--tjg-surface-panel] border-r border-solid border-[--tjg-border-default]">
    <!-- 搜索栏 -->
    <div class="p-16px pb-12px">
      <n-input
        v-model:value="searchKeyword"
        :placeholder="getSearchPlaceholder()"
        :input-props="{ spellcheck: false }"
        clearable
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        class="rounded-[var(--tjg-radius-md)] border-(solid 1px [--tjg-border-default]) w-full relative text-[length:var(--tjg-font-size-sm)]"
        size="small">
        <template #prefix>
          <svg class="size-16px text-[--tjg-text-secondary] opacity-60" aria-hidden="true">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- 动态内容区域 -->
    <div class="flex-1 px-8px overflow-hidden">
      <div class="pl-4px mb-12px">
        <span class="text-[length:var(--tjg-font-size-base)] font-500 text-[--tjg-text-primary]">
          {{ getSectionTitle() }}
        </span>
      </div>

      <n-scrollbar class="h-[calc(var(--tjg-viewport-height, 100vh)/var(--page-scale,1)-110px)]">
        <div class="pr-12px">
          <!-- 全部选项 -->
          <UserItem
            :item="getAllOption()"
            :is-selected="selectedUser === '' && selectedRoom === ''"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 动态列表内容 -->
          <component
            :is="getItemComponent()"
            v-for="item in filteredList"
            :key="getItemKey(item)"
            :item="item"
            :is-selected="isItemSelected(item)"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 空状态 -->
          <div v-if="isEmptyFilteredList" class="flex-center h-200px">
            <EmptyState compact illustration="no-results" :description="getEmptyMessage()" />
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex-center h-200px">
            <n-spin size="small" />
            <span class="ml-8px text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] opacity-60">
              {{ t('fileManager.common.loading') }}
            </span>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { useOperationFeedback } from '@/composables/common/useOperationFeedback'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useRoomStore } from '@/stores/domains/chat/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import UserItem from './UserItem.vue'

const logger = createLogger('UserList')

type UndefinedProps<T> = { [K in keyof T]: T[K] | undefined }

type FileManagerContactItem = UndefinedProps<MatrixContact> & {
  avatar: string
}

type FileManagerGroupItem = UndefinedProps<MatrixGroupInfo> & {
  avatar: string
}

type FileManagerOptionItem = {
  id?: string | undefined
  uid?: string | undefined
  roomId?: string | undefined
  directRoomId?: string | undefined
  name?: string | undefined
  roomName?: string | undefined
  groupName?: string | undefined
  nickname?: string | undefined
  avatar: string
}

type FileManagerListItem = Partial<FileManagerContactItem & FileManagerGroupItem> & FileManagerOptionItem

type FileManagerState = {
  activeNavigation: Ref<string>
  userList: Ref<FileManagerListItem[]>
  selectedUser: Ref<string>
  selectedRoom: Ref<string>
  setSearchKeyword: (keyword: string) => void
  setSelectedUser: (userId: string) => void
  setSelectedRoom: (roomId: string) => void
}

const { t } = useI18n()
const { reportFailure } = useOperationFeedback()
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { activeNavigation, selectedUser, selectedRoom, setSelectedUser, setSelectedRoom } = fileManagerState

// Store 实例
const contactStore = useContactStore()
const groupStore = useGroupStore()
const roomStore = useRoomStore()

// 本地状态
const searchKeyword = ref('')
const loading = ref(false)

// 是否显示用户列表
const shouldShowUserList = computed(() => {
  return activeNavigation.value !== 'myFiles'
})

// 获取当前显示的列表
const currentList = computed(() => {
  switch (activeNavigation.value) {
    case 'senders':
      return enrichedContactsList.value
    case 'sessions':
      return sessionRoomList.value
    case 'groups':
      return groupChatList.value
    default:
      return []
  }
})

const getItemLabel = (item: FileManagerListItem) => {
  return item.name || item.roomName || item.groupName || item.nickname || ''
}

const getUserSelectionId = (item: FileManagerListItem) => {
  return item.uid || item.id || ''
}

const getRoomSelectionId = (item: FileManagerListItem) => {
  return item.roomId || item.directRoomId || item.id || ''
}

const getItemKey = (item: FileManagerListItem) => {
  return getRoomSelectionId(item) || getUserSelectionId(item)
}

// 丰富好友数据
const enrichedContactsList = computed(() => {
  return contactStore.contactsList.map((item) => {
    const userInfo = groupStore.getUserInfo(item.userId)
    return {
      ...item,
      name: userInfo?.name || item.remark || t('fileManager.common.unknownUser'),
      avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logo.png'),
      activeStatus: item.activeStatus
    }
  })
})

// 会话列表：取同步得到的全部房间（单聊 + 群聊）。
// 旧实现直接把好友列表当会话列表，未包含群聊且与真实房间无关。
const sessionRoomList = computed<FileManagerListItem[]>(() => {
  return roomStore.roomList.map((room) => ({
    roomId: room.roomId,
    roomName: room.name,
    name: room.name,
    avatar: AvatarUtils.getAvatarUrl(room.avatarUrl || '/logo.png')
  }))
})

// 群聊列表：取同步得到的非私聊房间。
// 旧实现依赖 groupStore.groupDetails，只有打开过群资料才有数据，导致列表长期为空。
const groupChatList = computed<FileManagerListItem[]>(() => {
  return roomStore.groupRooms.map((room) => ({
    roomId: room.roomId,
    roomName: room.name,
    name: room.name,
    avatar: AvatarUtils.getAvatarUrl(room.avatarUrl || '/logo.png')
  }))
})

// 过滤后的列表
const filteredList = computed(() => {
  if (!searchKeyword.value) {
    return currentList.value
  }

  return currentList.value.filter((item) => {
    return getItemLabel(item).toLowerCase().includes(searchKeyword.value.toLowerCase())
  })
})

// 搜索无结果（仅在有关键词且非加载中时展示空态）
const isEmptyFilteredList = computed(() => filteredList.value.length === 0 && !!searchKeyword.value && !loading.value)

// 获取搜索占位符
const getSearchPlaceholder = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.searchPlaceholder.senders')
    case 'sessions':
      return t('fileManager.userList.searchPlaceholder.sessions')
    case 'groups':
      return t('fileManager.userList.searchPlaceholder.groups')
    default:
      return t('fileManager.userList.searchPlaceholder.default')
  }
}

// 获取区域标题
const getSectionTitle = () => {
  const count = filteredList.value.length
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.sectionTitle.senders', { count })
    case 'sessions':
      return t('fileManager.userList.sectionTitle.sessions', { count })
    case 'groups':
      return t('fileManager.userList.sectionTitle.groups', { count })
    default:
      return t('fileManager.userList.sectionTitle.default', { count })
  }
}

// 获取全部选项
const getAllOption = (): FileManagerOptionItem => {
  switch (activeNavigation.value) {
    case 'senders':
      return { id: '', name: t('fileManager.userList.allOptions.senders'), avatar: '' }
    case 'sessions':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.sessions'), avatar: '' }
    case 'groups':
      return { roomId: '', roomName: t('fileManager.userList.allOptions.groups'), avatar: '' }
    default:
      return { id: '', name: t('fileManager.userList.allOptions.default'), avatar: '' }
  }
}

// 获取列表项组件
const getItemComponent = () => {
  // 都使用 UserItem 组件，但传入不同的数据
  return UserItem
}

// 判断项目是否被选中
const isItemSelected = (item: FileManagerListItem) => {
  switch (activeNavigation.value) {
    case 'senders':
      return selectedUser.value === getUserSelectionId(item)
    case 'sessions':
    case 'groups':
      return selectedRoom.value === getRoomSelectionId(item)
    default:
      return false
  }
}

// 获取空状态消息
const getEmptyMessage = () => {
  switch (activeNavigation.value) {
    case 'senders':
      return t('fileManager.userList.empty.senders')
    case 'sessions':
      return t('fileManager.userList.empty.sessions')
    case 'groups':
      return t('fileManager.userList.empty.groups')
    default:
      return t('fileManager.userList.empty.default')
  }
}

// 处理项目点击
const handleItemClick = (item: FileManagerListItem) => {
  switch (activeNavigation.value) {
    case 'senders':
      setSelectedUser(getUserSelectionId(item))
      break
    case 'sessions':
    case 'groups':
      setSelectedRoom(getRoomSelectionId(item))
      break
  }
}

// 加载联系人列表
const loadContacts = async () => {
  try {
    loading.value = true
    await contactStore.getContactList()
  } catch (error) {
    logger.error('Failed to load contacts:', error)
    reportFailure(error, 'common.load_failed')
  } finally {
    loading.value = false
  }
}

// 监听导航变化
watch(
  activeNavigation,
  async (newNav) => {
    if (!shouldShowUserList.value) return

    switch (newNav) {
      case 'senders':
        // 发送人列表使用好友列表，确保联系人数据已加载
        if (contactStore.contactsList.length === 0) {
          await loadContacts()
        }
        break
      // sessions / groups 直接由 roomStore 响应式提供，无需额外加载
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss"></style>
