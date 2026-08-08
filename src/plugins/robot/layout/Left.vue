<template>
  <n-flex
    data-tauri-drag-region
    vertical
    :size="0"
    class="bg-[--chat-left-bg] select-none w-300px h-full p-[40px_20px_6px_20px] box-border">
    <n-flex vertical :size="30" data-tauri-drag-region>
      <!-- 标题 -->
      <n-flex justify="space-between" align="center" :size="0">
        <n-flex :size="4" vertical>
          <n-flex :size="0" align="center">
            <p class="text-(20px [--tjg-text-primary]) font-semibold select-none">Tjg-</p>
            <p class="gpt-subtitle">ChatBot</p>
            <div class="ml-6px p-[4px_8px] size-fit bg-[--bate-bg] rounded-8px text-(12px [--bate-color] center)">
              Beta
            </div>
          </n-flex>
          <p class="text-(12px [--tjg-text-tertiary])">{{ t('ai_assistant.robot.subtitle_desc') }}</p>
        </n-flex>
        <svg class="size-44px color-[--tjg-color-primary-500] opacity-20"><use href="#GPT"></use></svg>
      </n-flex>

      <!-- 头像和插件 -->
      <n-flex align="center" justify="space-between" :size="0">
        <n-flex align="center">
          <n-avatar bordered round :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" :size="48" />
          <n-flex vertical>
            <p class="text-(14px [--tjg-text-primary]) font-500">{{ userStore.userInfo?.name ?? '' }}</p>
            <p class="text-(12px [--tjg-text-tertiary])">{{ t('ai_assistant.robot.expire_days', { days: 28 }) }}</p>
          </n-flex>
        </n-flex>

        <!-- 插件按钮已隐藏 -->
        <!-- <div class="plugins">
          <svg class="size-22px"><use href="#plugins"></use></svg>
          <p>插件</p>
        </div> -->
      </n-flex>
      <!-- 会话列表 -->
      <n-scrollbar
        ref="scrollbar"
        style="max-height: calc(100vh / var(--page-scale, 1) - 286px); padding-right: 8px"
        @scroll="handleScroll">
        <!-- 加载状态 -->
        <div v-if="loading && pageNo === 1" class="flex justify-center items-center py-20px">
          <n-spin size="small" />
          <span class="ml-10px text-(12px [--tjg-text-tertiary])">{{ t('ai_assistant.robot.loading') }}</span>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="chatList.length === 0"
          class="flex flex-col items-center justify-center py-20px text-(12px [--tjg-text-tertiary])">
          <svg class="size-40px mb-10px opacity-50"><use href="#empty"></use></svg>
          <p>{{ t('ai_assistant.robot.no_conversation') }}</p>
        </div>

        <TransitionGroup
          v-else
          name="list"
          tag="div"
          style="padding: 4px"
          class="sort-target flex flex-col-center gap-12px">
          <div
            v-for="(item, index) in chatList"
            :key="item.id"
            class="chat-item-wrapper relative mb-5px"
            @click="handleActive(item)">
            <ContextMenu
              :menu="menuList"
              :special-menu="specialMenuList"
              @select="(menuItem) => menuItem.click?.(item as any)">
              <div class="relative w-full">
                <RobotCard
                  v-if="editingItemId !== item.id"
                  :robot="mapChatItemToRobot(item, index)"
                  :active="activeItem?.id === item.id" />
                <n-input
                  v-else
                  @blur="handleBlur(item, index)"
                  ref="inputInstRef"
                  v-model:value="item.title"
                  clearable
                  :placeholder="t('ai_assistant.robot.input_title')"
                  type="text"
                  size="tiny"
                  spellCheck="false"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  style="width: 200px"
                  class="h-22px lh-22px rounded-6px"></n-input>
                <svg
                  @click.stop="deleteChat(item)"
                  class="chat-item-delete color-[--tjg-text-primary] size-20px absolute right-4px top-4px">
                  <use href="#squareClose"></use>
                </svg>
              </div>
            </ContextMenu>
          </div>
        </TransitionGroup>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="flex justify-center items-center py-16px">
          <n-button v-if="!loadingMore" size="small" tertiary @click="loadMore">
            {{ t('ai_assistant.robot.load_more') }}
          </n-button>
          <n-spin v-else size="small" />
          <span v-if="loadingMore" class="ml-10px text-(12px [--tjg-text-tertiary])">
            {{ t('ai_assistant.robot.loading') }}
          </span>
        </div>

        <!-- 没有更多数据 -->
        <div
          v-else-if="chatList.length > 0"
          class="flex justify-center items-center py-16px text-(12px [--tjg-text-tertiary])">
          <span>{{ t('ai_assistant.robot.no_more_conversations') }}</span>
        </div>
      </n-scrollbar>
    </n-flex>

    <!-- 底部选项栏 -->
    <n-flex data-tauri-drag-region vertical :size="8" class="m-[auto_0_0_0]">
      <!-- 管理按钮行 -->
      <n-flex :size="4" align="center" justify="space-between">
        <n-flex :size="4" align="center">
          <div
            @click="jump"
            class="bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) color-[--tjg-text-primary] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer">
            <svg class="size-18px"><use href="#settings"></use></svg>
          </div>
          <div
            @click="openExternalUrl('https://gitee.com/llangkebo/hula/')"
            class="bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) color-[--tjg-text-primary] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer">
            <svg class="size-18px"><use href="#github"></use></svg>
          </div>
        </n-flex>

        <n-flex :size="4" align="center">
          <div
            @click="openHistory"
            class="bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) color-[--tjg-text-primary] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            :title="t('ai_assistant.robot.generation_history')">
            <Icon icon="mdi:history" class="text-18px" />
          </div>
          <div
            @click="openModelManagement"
            class="bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) color-[--tjg-text-primary] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            :title="t('ai_assistant.robot.manage_model')">
            <Icon icon="mdi:robot-outline" class="text-18px" />
          </div>
          <div
            @click="openRoleManagement"
            class="bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) color-[--tjg-text-primary] size-fit p-[8px_9px] rounded-8px custom-shadow cursor-pointer"
            :title="t('ai_assistant.robot.manage_role')">
            <Icon icon="mdi:account-cog" class="text-18px" />
          </div>
        </n-flex>
      </n-flex>

      <!-- 操作按钮行 -->
      <n-flex :size="4" align="center" justify="space-between">
        <!-- 提示信息或新建按钮 -->
        <div v-if="!hasRoles" class="flex-1 text-(11px [--tjg-color-danger-500]) text-center">
          {{ t('ai_assistant.robot.create_role_first') }}
        </div>
        <div
          v-else
          @click="add"
          class="flex items-center justify-center gap-4px bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) select-none text-(12px [--tjg-text-primary]) size-fit w-80px h-32px rounded-8px custom-shadow cursor-pointer">
          <svg class="size-15px pb-2px"><use href="#plus"></use></svg>
          <p>{{ t('ai_assistant.robot.new_chat') }}</p>
        </div>

        <n-popconfirm v-model:show="showDeleteConfirm">
          <template #icon>
            <svg class="size-22px"><use href="#explosion"></use></svg>
          </template>
          <template #action>
            <n-button size="small" tertiary @click.stop="showDeleteConfirm = false">
              {{ t('ai_assistant.robot.cancel') }}
            </n-button>
            <n-button size="small" type="error" @click.stop="deleteAllChats">
              {{ t('ai_assistant.robot.delete') }}
            </n-button>
          </template>
          <template #trigger>
            <div
              class="flex items-center justify-center gap-4px bg-[--chat-bt-color] border-(1px solid [--tjg-border-default]) select-none text-(12px [--tjg-text-primary]) size-fit w-80px h-32px rounded-8px custom-shadow cursor-pointer">
              <svg class="size-15px pb-2px"><use href="#delete"></use></svg>
              <p>{{ t('ai_assistant.robot.delete_all') }}</p>
            </div>
          </template>
          {{ t('ai_assistant.robot.confirm_delete_all') }}
        </n-popconfirm>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { InputInst, VirtualListInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import RobotCard, { type RobotCardData } from '@/plugins/robot/components/RobotCard.vue'
import router from '@/router'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import { chatRoleService } from '@/services/matrix/ai/ChatRoleService'
import type { Conversation } from '@/services/matrix/ai/ConversationService'
import { conversationService } from '@/services/matrix/ai/ConversationService'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatChatTime } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('RobotLeft')
const timerManager = useTimerManager()

import { openExternalUrl } from '@/composables/common/useLinkSegments'

const userStore = useUserStore()
const activeItem = ref<ChatItem | null>(null)
const scrollbar = ref<VirtualListInst>()
const inputInstRef = ref<InputInst | null>(null)
const editingItemId = ref<string | null>()
const loading = ref(false)
const loadingMore = ref(false)
/** 原始标题 */
const originalTitle = ref('')
const showDeleteConfirm = ref(false)
/** 是否有可用角色 */
const hasRoles = ref(false)
/** 第一个可用角色的ID */
const firstAvailableRoleId = ref<string | null>(null)

// 分页参数
const pageNo = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const total = ref(0)

// 会话列表数据
interface ChatItem {
  id: string
  title?: string
  createTime: number
  messageCount?: number
  isPinned?: boolean
  roleId?: string | number
  modelId?: string | number
}

const chatList = ref<ChatItem[]>([])

/** Map a ChatItem to RobotCardData for the RobotCard component */
const mapChatItemToRobot = (item: ChatItem, index: number): RobotCardData => ({
  id: item.id,
  name: item.title || t('ai_assistant.robot.conversation_title', { index: index + 1 }),
  messageCount: item.messageCount ?? 0,
  time: formatChatTime(item.createTime)
})

// 获取会话列表
const fetchConversationList = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
    pageNo.value = 1
    hasMore.value = true
  }

  try {
    const data = await conversationService.page({
      pageNo: pageNo.value,
      pageSize: pageSize.value
    })

    if (data?.list) {
      const newChats = data.list.map((item: Conversation) => {
        const parsedCreateTime = Number(item.createTime)
        return {
          id: item.id,
          title: item.title || t('ai_assistant.robot.conversation_title', { index: item.id }),
          createTime: Number.isFinite(parsedCreateTime) ? parsedCreateTime : Date.now(),
          messageCount: item.messageCount || 0,
          isPinned: item.isPinned || false,
          roleId: item.roleId,
          modelId: item.modelId
        }
      })

      if (isLoadMore) {
        // 加载更多时追加数据
        chatList.value = [...chatList.value, ...newChats]
      } else {
        // 首次加载时替换数据
        chatList.value = newChats

        // 首次加载且有会话时，自动选择第一个会话
        if (newChats.length > 0) {
          // 延迟发送事件，确保 Chat.vue 的列表已加载
          timerManager.setTimeout(() => {
            handleActive(newChats[0])
          }, 500)
        }
      }

      // 更新分页信息
      total.value = data.total || 0
      hasMore.value = chatList.value.length < total.value

      // 如果还有更多数据，增加页码
      if (hasMore.value) {
        pageNo.value++
      }
    }
  } catch (error) {
    logger.error('获取会话列表失败:', error)
    showFeedback(t('ai_assistant.robot.fetch_conversations_failed'), 'error')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 加载更多
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  await fetchConversationList(true)
}

// 滚动事件处理
const handleScroll = (e: Event) => {
  const scrollElement = e.target as HTMLElement
  const { scrollTop, scrollHeight, clientHeight } = scrollElement

  // 滚动到底部时自动加载更多（距离底部100px时触发）
  if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore.value && hasMore.value) {
    loadMore()
  }
}

// 刷新会话列表
const refreshConversationList = async () => {
  pageNo.value = 1
  await fetchConversationList(false)
}

const menuList = ref<OPT.RightMenu[]>([
  {
    label: () => t('ai_assistant.robot.pin'),
    icon: 'topping',
    click: (item: ChatItem) => {
      const index = chatList.value.findIndex((e) => e.id === item.id)
      if (index !== 0) {
        const temp = chatList.value[index]
        chatList.value[index] = chatList.value[0]
        chatList.value[0] = temp
      }
    }
  },
  {
    label: () => t('ai_assistant.robot.open_standalone_window'),
    icon: 'freezing-line-column',
    click: (item: ChatItem) => {
      logger.debug('打开独立窗口:', item)
    }
  },
  {
    label: () => t('ai_assistant.robot.rename'),
    icon: 'edit',
    click: (item: ChatItem) => {
      renameChat(item)
    }
  }
])

const specialMenuList = ref<OPT.RightMenu[]>([
  {
    label: () => t('ai_assistant.robot.delete'),
    icon: 'delete',
    click: (item: ChatItem) => {
      deleteChat(item)
    }
  }
])

/** 跳转到设置 */
const jump = () => {
  router.push('/chatSettings')
  activeItem.value = null
}

/** 选中会话 */
const handleActive = (item: ChatItem) => {
  activeItem.value = item

  if (router.currentRoute.value.path !== '/chat') {
    router.push('/chat').then(() => {
      nextTick(() => {
        useMitt.emit('chat-active', item)
      })
    })
  } else {
    // 已经在 /chat 路由，直接触发事件
    nextTick(() => {
      useMitt.emit('chat-active', item)
    })
  }
}

// 检查是否有可用角色
const checkHasRoles = async () => {
  try {
    const data = await chatRoleService.page({ pageNo: 1, pageSize: 100 })
    // 检查是否有可用的角色（status === 0）
    const availableRoles = (data.list || []).filter((item: ChatRole) => item.status === 0)
    hasRoles.value = availableRoles.length > 0
    // 保存第一个可用角色的ID
    firstAvailableRoleId.value = availableRoles.length > 0 ? availableRoles[0].id : null
  } catch (error) {
    logger.error('检查角色失败:', error)
    hasRoles.value = false
    firstAvailableRoleId.value = null
  }
}

// 打开角色管理
const openRoleManagement = () => {
  useMitt.emit('open-role-management')
}

// 打开模型管理
const openModelManagement = () => {
  useMitt.emit('open-model-management')
}

// 打开生成历史
const openHistory = () => {
  useMitt.emit('open-generation-history')
}

/** 添加会话 */
const add = async () => {
  // 检查是否有可用角色
  if (!hasRoles.value || !firstAvailableRoleId.value) {
    showFeedback(t('ai_assistant.robot.create_role_first'), 'warning')
    openRoleManagement()
    return
  }

  try {
    const data = await conversationService.create({
      roleId: firstAvailableRoleId.value,
      knowledgeId: undefined,
      title: t('ai_assistant.robot.new_conversation_title')
    })

    if (data) {
      const rawCreateTime = Number(data.createTime)
      const newChat: ChatItem = {
        id: data.id,
        title: data.title || t('ai_assistant.robot.new_conversation_title'),
        createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
        messageCount: data.messageCount || 0,
        isPinned: data.isPinned || data.pinned || false,
        roleId: firstAvailableRoleId.value,
        modelId: data.modelId
      }

      // 新会话添加到列表顶部
      chatList.value.unshift(newChat)

      // 滚动到顶部
      nextTick(() => {
        scrollbar.value?.scrollTo({ position: 'top' })
      })

      // 激活新会话
      handleActive(newChat)

      showFeedback(t('ai_assistant.robot.conversation_created'), 'success')
    }
  } catch (error) {
    logger.error('创建会话失败:', error)
    showFeedback(t('ai_assistant.robot.create_conversation_failed'), 'error')
  }
}

/** 删除单个会话 */
const deleteChat = async (item: ChatItem) => {
  try {
    await conversationService.delete({ conversationIdList: [item.id] })

    const index = chatList.value.findIndex((chat) => chat.id === item.id)
    if (index !== -1) {
      chatList.value.splice(index, 1)

      // 如果删除的是当前选中的会话，需要重新选择
      if (activeItem.value?.id === item.id) {
        if (chatList.value.length > 0) {
          // 选中第一个会话
          const firstChat = chatList.value[0]
          activeItem.value = firstChat

          // 跳转到聊天页面
          router.push('/chat')
        } else {
          // 如果没有会话了，跳转到欢迎页
          activeItem.value = null
          router.push('/welcome')
        }
      }

      showFeedback(t('ai_assistant.robot.conversation_deleted'), 'success')
    }
  } catch (error) {
    logger.error('删除会话失败:', error)
    showFeedback(t('ai_assistant.robot.delete_conversation_failed'), 'error')
  }
}

/** 删除全部会话 */
const deleteAllChats = async () => {
  try {
    if (chatList.value.length === 0) {
      showFeedback(t('ai_assistant.robot.no_conversations_to_delete'), 'warning')
      showDeleteConfirm.value = false
      return
    }

    const allChatIds = chatList.value.map((chat) => chat.id)
    await conversationService.delete({ conversationIdList: allChatIds })

    // 清空本地列表
    chatList.value = []
    activeItem.value = null
    showDeleteConfirm.value = false

    // 跳转到欢迎页
    router.push('/welcome')

    showFeedback(t('ai_assistant.robot.all_conversations_deleted'), 'success')
  } catch (error) {
    logger.error('删除全部会话失败:', error)
    showFeedback(t('ai_assistant.robot.delete_all_failed'), 'error')
  }
}

/** 重命名 */
const renameChat = (item: ChatItem) => {
  originalTitle.value = item.title || ''
  editingItemId.value = item.id
  nextTick(() => {
    inputInstRef.value?.select()
  })
}

const handleBlur = async (item: ChatItem, index: number) => {
  editingItemId.value = null

  const trimmedTitle = item.title?.trim() || ''
  const fallbackTitle = t('ai_assistant.robot.conversation_title', { index: item.id })
  const nextTitle = trimmedTitle !== '' ? trimmedTitle : fallbackTitle

  if (originalTitle.value === nextTitle) {
    chatList.value[index].title = nextTitle
    return
  }

  const previousTitle = originalTitle.value
  item.title = nextTitle
  chatList.value[index].title = nextTitle
  if (activeItem.value?.id === item.id) {
    activeItem.value.title = nextTitle
  }

  try {
    await conversationService.update({
      id: item.id,
      title: nextTitle
    })

    originalTitle.value = nextTitle
    showFeedback(t('ai_assistant.robot.renamed_to', { name: nextTitle }), 'success')
    useMitt.emit('left-chat-title', { id: item.id, title: nextTitle })
    useMitt.emit('update-chat-title', { id: item.id, title: nextTitle })
  } catch (error) {
    logger.error('重命名会话失败:', error)
    item.title = previousTitle
    chatList.value[index].title = previousTitle
    originalTitle.value = previousTitle
    if (activeItem.value?.id === item.id) {
      activeItem.value.title = previousTitle
    }
  }
}

onMounted(async () => {
  // 加载会话列表
  await fetchConversationList()

  // 检查是否有可用角色
  checkHasRoles()

  // 如果没有会话，跳转到欢迎页面
  if (chatList.value.length === 0) {
    router.push('/welcome')
  }

  useMitt.on('update-chat-title', (e: { id: string; title: string }) => {
    chatList.value.forEach((item) => {
      if (item.id === e.id) {
        item.title = e.title
      }
    })
  })

  useMitt.on('return-chat', () => {
    if (chatList.value.length > 0) {
      handleActive(chatList.value[0])
    }
  })

  // 监听会话刷新事件
  useMitt.on('refresh-conversations', () => {
    refreshConversationList()
  })

  // 监听角色管理刷新事件
  useMitt.on('refresh-roles', () => {
    checkHasRoles()
  })

  // ✅ 监听添加会话事件
  useMitt.on('add-conversation', (newChat: Conversation) => {
    if (newChat?.id) {
      // 检查是否已存在
      const exists = chatList.value.some((chat) => chat.id === newChat.id)
      if (!exists) {
        const rawCreateTime = Number(newChat.createTime)
        const normalizedChat: ChatItem = {
          id: newChat.id,
          title: newChat.title,
          createTime: Number.isFinite(rawCreateTime) ? rawCreateTime : Date.now(),
          messageCount: newChat.messageCount || 0,
          isPinned: newChat.isPinned || false,
          roleId: newChat.roleId,
          modelId: newChat.modelId
        }

        // 添加到列表顶部
        chatList.value.unshift(normalizedChat)

        // 滚动到顶部
        nextTick(() => {
          scrollbar.value?.scrollTo({ position: 'top' })
        })

        handleActive(normalizedChat)
      }
    }
  })

  useMitt.on('update-chat-meta', (payload: { id: string; messageCount?: number; createTime?: number }) => {
    if (!payload?.id) return
    const target = chatList.value.find((chat) => chat.id === payload.id)
    if (target) {
      if (typeof payload.messageCount === 'number') {
        target.messageCount = payload.messageCount
      }
      if (payload.createTime !== undefined && payload.createTime !== null) {
        const parsed = Number(payload.createTime)
        if (Number.isFinite(parsed)) {
          target.createTime = parsed
        }
      }
    }

    const active = activeItem.value
    if (active && active.id === payload.id) {
      if (typeof payload.messageCount === 'number') {
        active.messageCount = payload.messageCount
      }
      if (payload.createTime !== undefined && payload.createTime !== null) {
        const parsed = Number(payload.createTime)
        if (Number.isFinite(parsed)) {
          active.createTime = parsed
        }
      }
    }
  })
})
</script>

<style scoped lang="scss">
.gpt-subtitle {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-[--tjg-color-primary-400] to-[--tjg-color-primary-500] text-20px font-800;
}

.plugins {
  @apply size-fit bg-[--chat-bt-color] rounded-8px custom-shadow p-[8px_14px]
  flex items-center gap-10px select-none cursor-pointer
  text-14px color-[--tjg-text-primary] border-(1px solid [--tjg-border-default]);
}

.chat-item-wrapper {
  cursor: pointer;

  &:hover {
    .chat-item-delete {
      @apply opacity-100 -translate-x-2 transition-all duration-800 ease-in-out;
    }
  }
}

.chat-item-delete {
  @apply opacity-0 transition-all duration-800 ease-in-out;
}

.list-move, /* 对移动中的元素应用的过渡 */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}
</style>
