<template>
  <div
    v-show="shouldShowUserList"
    class="w-240px flex-shrink-0 flex flex-col bg-[--hula-surface-panel] border-r border-solid border-[--hula-border-default]">
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
        class="rounded-6px border-(solid 1px [--hula-border-default]) w-full relative text-12px"
        size="small">
        <template #prefix>
          <svg class="size-16px text-[--text-color] opacity-60">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <!-- 动态内容区域 -->
    <div class="flex-1 px-8px overflow-hidden">
      <div class="pl-4px mb-12px">
        <span class="text-14px font-500 text-[--text-color]">{{ getSectionTitle() }}</span>
      </div>

      <n-scrollbar style="height: calc(100vh / var(--page-scale, 1) - 110px)">
        <div class="pr-12px">
          <!-- 全部选项 -->
          <UserItem
            :user="getAllOption()"
            :is-selected="selectedUser === '' && selectedRoom === ''"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 动态列表内容 -->
          <component
            :is="getItemComponent()"
            v-for="item in filteredList"
            :key="getItemKey(item)"
            :user="item"
            :room="item"
            :contact="item"
            :is-selected="isItemSelected(item)"
            @click="handleItemClick"
            class="mb-8px" />

          <!-- 空状态 -->
          <div v-if="filteredList.length === 0 && searchKeyword && !loading" class="flex-center h-200px">
            <div class="flex-col-center">
              <svg class="size-48px text-[--text-color] opacity-30 mb-12px">
                <use href="#search"></use>
              </svg>
              <p class="text-14px text-[--text-color] opacity-60 m-0">{{ getEmptyMessage() }}</p>
            </div>
          </div>

          <!-- 加载状态 -->
          <div v-if="loading" class="flex-center h-200px">
            <n-spin size="small" />
            <span class="ml-8px text-14px text-[--text-color] opacity-60">加载中</span>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import UserItem from './UserItem.vue'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('UserList')

type FileManagerContactItem = MatrixContact & {
  avatar: string
}

type FileManagerGroupItem = MatrixGroupInfo & {
  avatar: string
}

type FileManagerOptionItem = {
  id?: string
  uid?: string
  roomId?: string
  directRoomId?: string
  name?: string
  roomName?: string
  groupName?: string
  nickname?: string
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
const fileManagerState = inject<FileManagerState>('fileManagerState')!
const { activeNavigation, selectedUser, selectedRoom, setSelectedUser, setSelectedRoom } = fileManagerState

// Store 实例
const contactStore = useContactStore()
const groupStore = useGroupStore()

// 本地状态
const searchKeyword = ref('')
const loading = ref(false)
const sessionList = ref<FileManagerContactItem[]>([])

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
      return sessionList.value
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
    const userInfo = groupStore.getUserInfo(item.uid)
    return {
      ...item,
      name: userInfo?.name || item.remark || t('fileManager.common.unknownUser'),
      avatar: AvatarUtils.getAvatarUrl(userInfo?.avatar || '/logoD.png'),
      activeStatus: item.activeStatus
    }
  })
})

// 群聊列表
const groupChatList = computed(() => {
  return [...groupStore.groupDetails]
    .map((item) => ({
      ...item,
      avatar: AvatarUtils.getAvatarUrl(item.avatar)
    }))
    .sort((a, b) => {
      // 将roomId为'1'的群聊排在最前面
      if (a.roomId === '1' && b.roomId !== '1') return -1
      if (a.roomId !== '1' && b.roomId === '1') return 1
      return 0
    })
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
    logger.error('加载联系人失败:', error)
  } finally {
    loading.value = false
  }
}

const loadSessions = async () => {
  try {
    loading.value = true
    sessionList.value = contactStore.contactsList.map((item) => ({
      ...item,
      avatar: AvatarUtils.getAvatarUrl(item.avatar)
    }))
  } catch (error) {
    logger.error('加载会话失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载群聊列表 (群组数据通过 groupStore 获取)
const loadGroups = async () => {
  try {
    loading.value = true
    // 群组数据已经在 groupStore 中管理，无需额外加载
    // 如果需要刷新群组数据，可以调用相应的 store 方法
  } catch (error) {
    logger.error('加载群聊失败:', error)
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
      case 'sessions':
        if (contactStore.contactsList.length === 0) {
          await loadContacts()
        }
        await loadSessions()
        break
      case 'groups':
        await loadGroups()
        break
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss"></style>
