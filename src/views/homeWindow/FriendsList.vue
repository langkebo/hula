<template>
  <div class="mt-30px pb-10px flex flex-col gap-10px border-b-(1px solid [--hula-border-layout-divider])">
    <div class="flex-center gap-5px w-full pr-16px pl-16px box-border">
      <n-input
        id="friends-search"
        v-model:value="searchText"
        @update:value="handleSearchInputChange"
        class="rounded-6px w-full relative text-12px"
        style="background: var(--hula-surface-search)"
        :maxlength="20"
        clearable
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        size="small"
        :placeholder="t('home.search_input_placeholder')">
        <template #prefix>
          <svg class="w-12px h-12px"><use href="#search"></use></svg>
        </template>
      </n-input>

      <n-popover
        v-model:show="addPanels.show"
        style="padding: 0; background: transparent; user-select: none"
        :show-arrow="false"
        trigger="click">
        <template #trigger>
          <n-button size="small" secondary style="padding: 0 5px">
            <template #icon>
              <svg class="w-24px h-24px"><use href="#plus"></use></svg>
            </template>
          </n-button>
        </template>

        <div @click.stop="addPanels.show = false" class="add-item">
          <div class="menu-list">
            <div v-for="(item, index) in addPanels.list" :key="index">
              <div class="menu-item" @click="() => item.click()">
                <svg><use :href="`#${item.icon}`"></use></svg>
                {{ t(item.label) }}
              </div>
            </div>
          </div>
        </div>
      </n-popover>
    </div>
  </div>

  <n-flex
    @click="handleApply"
    align="center"
    justify="space-between"
    class="my-10px p-12px hover:(bg-[--hula-surface-list-hover] cursor-pointer)">
    <div class="text-(14px [--hula-text-primary])">{{ t('home.friends_list.notice.friend') }}</div>
    <n-flex align="center" :size="4">
      <n-badge :value="globalStore.friendUnreadCount" :max="15" />
      <!-- <n-badge v-if="globalStore.friendUnreadCount > 0" dot color="#d5304f" /> -->
      <svg class="size-16px rotate-270 color-[--hula-text-primary]"><use href="#down"></use></svg>
    </n-flex>
  </n-flex>

  <n-flex
    @click="handleOpenSecretChat"
    align="center"
    justify="space-between"
    class="my-10px p-12px hover:(bg-[--hula-surface-list-hover] cursor-pointer)">
    <div class="text-(14px [--hula-text-primary])">{{ t('home.secret_chat.title') }}</div>
    <n-flex align="center" :size="4">
      <svg class="size-16px color-[--hula-text-primary]"><use href="#eye-close"></use></svg>
    </n-flex>
  </n-flex>

  <n-tabs type="segment" animated class="mt-4px p-[4px_10px_0px_8px]">
    <n-tab-pane name="1" :tab="t('home.friends_list.tabs.friend')">
      <n-collapse :display-directive="'show'" :default-expanded-names="['special', 'normal']">
        <ContextMenu @contextmenu="showMenu($event)" @select="handleSelect($event.label)" :menu="menuList">
          <!-- 特殊关心分组 -->
          <n-collapse-item v-if="specialContacts.length > 0" name="special">
            <template #header>
              <n-flex align="center" :size="8">
                <svg class="size-14px color-[--hula-color-warning-500]"><use href="#star-fill"></use></svg>
                <span>{{ t('home.friends_list.group.special') }}</span>
              </n-flex>
            </template>
            <template #header-extra>
              <span class="group-count">{{ specialOnlineCount }}/{{ specialContacts.length }}</span>
            </template>
            <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 270px)" @scroll="handleFriendScroll">
              <div @contextmenu.stop="$event.preventDefault()">
                <n-flex
                  v-for="item in specialContacts"
                  :key="item.uid"
                  @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                  :class="{ active: activeItem === item.uid }"
                  class="item-box w-full h-75px mb-5px"
                  align="center"
                  :size="10">
                  <n-avatar
                    round
                    style="border: 1px solid var(--avatar-border-color)"
                    :size="44"
                    class="grayscale"
                    :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE || isBotUser(item.uid) }"
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)!.avatar!)"
                    :color="avatarColor"
                    :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                  <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                    <span class="text-14px leading-tight flex-1 truncate">
                      {{ groupStore.getUserInfo(item.uid)!.name }}
                    </span>
                    <div class="text leading-tight text-12px flex-y-center gap-4px flex-1 truncate">
                      [
                      <template v-if="isBotUser(item.uid)">{{ t('home.friends_list.bot_tag') }}</template>
                      <template v-else-if="getUserState(item.uid)">
                        <img class="size-12px rounded-50%" :src="getUserState(item.uid)?.url" alt="" />
                        {{ translateStateTitle(getUserState(item.uid)?.title) }}
                      </template>
                      <template v-else>
                        <n-badge :color="getPresenceBadgeColor(item.activeStatus)" dot />
                        {{
                          item.activeStatus === OnlineEnum.ONLINE
                            ? t('home.friends_list.status.online')
                            : t('home.friends_list.status.offline')
                        }}
                      </template>
                      ]
                    </div>
                  </n-flex>
                </n-flex>
              </div>
            </n-scrollbar>
          </n-collapse-item>

          <!-- 普通好友分组 -->
          <n-collapse-item name="normal">
            <template #header>
              <n-flex align="center" :size="8">
                <svg class="size-14px color-[--hula-text-secondary]"><use href="#friends"></use></svg>
                <span>{{ t('home.friends_list.group.normal') }}</span>
              </n-flex>
            </template>
            <template #header-extra>
              <span class="group-count">{{ normalOnlineCount }}/{{ normalContacts.length }}</span>
            </template>
            <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 270px)" @scroll="handleFriendScroll">
              <div @contextmenu.stop="$event.preventDefault()">
                <n-flex
                  v-for="item in normalContacts"
                  :key="item.uid"
                  @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                  :class="{ active: activeItem === item.uid }"
                  class="item-box w-full h-75px mb-5px"
                  align="center"
                  :size="10">
                  <n-avatar
                    round
                    style="border: 1px solid var(--avatar-border-color)"
                    :size="44"
                    class="grayscale"
                    :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE || isBotUser(item.uid) }"
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)!.avatar!)"
                    :color="avatarColor"
                    :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                  <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                    <span class="text-14px leading-tight flex-1 truncate">
                      {{ groupStore.getUserInfo(item.uid)!.name }}
                    </span>
                    <div class="text leading-tight text-12px flex-y-center gap-4px flex-1 truncate">
                      [
                      <template v-if="isBotUser(item.uid)">{{ t('home.friends_list.bot_tag') }}</template>
                      <template v-else-if="getUserState(item.uid)">
                        <img class="size-12px rounded-50%" :src="getUserState(item.uid)?.url" alt="" />
                        {{ translateStateTitle(getUserState(item.uid)?.title) }}
                      </template>
                      <template v-else>
                        <n-badge :color="getPresenceBadgeColor(item.activeStatus)" dot />
                        {{
                          item.activeStatus === OnlineEnum.ONLINE
                            ? t('home.friends_list.status.online')
                            : t('home.friends_list.status.offline')
                        }}
                      </template>
                      ]
                    </div>
                  </n-flex>
                </n-flex>
              </div>
            </n-scrollbar>
          </n-collapse-item>

          <!-- 屏蔽好友分组 -->
          <n-collapse-item v-if="blockedContacts.length > 0" name="blocked">
            <template #header>
              <n-flex align="center" :size="8">
                <svg class="size-14px color-[--hula-text-quaternary]"><use href="#forbidden"></use></svg>
                <span>{{ t('home.friends_list.group.blocked') }}</span>
              </n-flex>
            </template>
            <template #header-extra>
              <span class="group-count">{{ blockedContacts.length }}</span>
            </template>
            <n-scrollbar style="max-height: calc(100vh / var(--page-scale, 1) - 270px)">
              <div @contextmenu.stop="$event.preventDefault()">
                <n-flex
                  v-for="item in blockedContacts"
                  :key="item.uid"
                  @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                  :class="{ active: activeItem === item.uid }"
                  class="item-box w-full h-75px mb-5px opacity-60"
                  align="center"
                  :size="10">
                  <n-avatar
                    round
                    style="border: 1px solid var(--avatar-border-color)"
                    :size="44"
                    class="grayscale"
                    :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)!.avatar!)"
                    :color="avatarColor"
                    :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'" />
                  <n-flex vertical justify="space-between" class="h-fit flex-1 truncate">
                    <span class="text-14px leading-tight flex-1 truncate">
                      {{ groupStore.getUserInfo(item.uid)!.name }}
                    </span>
                    <div class="text leading-tight text-12px">[{{ t('home.friends_list.status.blocked') }}]</div>
                  </n-flex>
                </n-flex>
              </div>
            </n-scrollbar>
          </n-collapse-item>
        </ContextMenu>
      </n-collapse>
    </n-tab-pane>
  </n-tabs>
</template>
<script setup lang="ts" name="friendsList">
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFriends } from '@/composables/useFriends'
import { MittEnum, OnlineEnum, RoomTypeEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import { useWindow } from '@/hooks/useWindow'
import type { DetailsContent } from '@/services/types'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { SPACE_ROUTE_NAMES, buildSpaceWorkbenchRoute } from '@/router/spaceNavigation'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { unreadCountManager } from '@/utils/UnreadCountManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FriendsList')

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { createWebviewWindow } = useWindow()
const menuList = computed(() => [
  { label: t('home.friends_list.menu.add_group'), icon: 'plus' },
  { label: t('home.friends_list.menu.rename_group'), icon: 'edit' },
  { label: t('home.friends_list.menu.delete_group'), icon: 'delete' }
])
const detailsShow = ref(false)
const searchText = ref('')
const contactStore = useContactStore()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const avatarColor = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '' : 'var(--hula-text-inverse)'))
const getPresenceBadgeColor = (status: OnlineEnum) =>
  status === OnlineEnum.ONLINE ? 'var(--hula-color-primary-100)' : 'var(--hula-text-tertiary)'
const {
  specialContacts,
  specialOnlineCount,
  blockedContacts,
  normalContacts,
  normalOnlineCount,
  selectedItem: activeItem,
  isBotUser,
  getUserState,
  setSelectedItem,
  clearSelectedItem
} = useFriends()

const addPanels = ref({
  show: false,
  list: [
    {
      label: 'menu.add_friend',
      icon: 'people-plus',
      click: async () => {
        await createWebviewWindow(t('menu.add_friend'), 'searchFriend', 500, 580)
      }
    }
  ]
})

const handleClick = (index: string, type: number) => {
  detailsShow.value = true
  setSelectedItem(index)
  const data = {
    context: {
      type: type,
      uid: index
    },
    detailsShow: detailsShow.value
  }
  useMitt.emit(MittEnum.DETAILS_SHOW, data)
}
// todo 需要循环数组来展示分组
const showMenu = (event: MouseEvent) => {
  logger.debug('showMenu', event)
}

const handleSelect = (event: MouseEvent) => {
  logger.debug('handleSelect', event)
}

const handleSearchInputChange = (value: string) => {
  searchText.value = value

  const nextSearch = value.trim()
  if (!nextSearch) return

  searchText.value = ''
  void router.push(buildSpaceWorkbenchRoute(undefined, { ...route.query, search: nextSearch }))
}

const handleFriendScroll = (e: Event) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement
  if (scrollHeight - scrollTop - clientHeight < 20) {
    contactStore.getContactList(false)
  }
}

const resetSelection = () => {
  detailsShow.value = false
  clearSelectedItem()
  useMitt.emit(MittEnum.DETAILS_SHOW, {
    context: undefined,
    detailsShow: false
  })
}

const handleApply = async () => {
  // 刷新好友申请列表
  await contactStore.getApplyPage('friend', true, true)

  // 更新未读数
  globalStore.clearFriendUnreadCount()
  globalStore.refreshUnreadBadge()

  useMitt.emit(MittEnum.APPLY_SHOW, {
    context: {
      type: 'apply',
      applyType: 'friend'
    } as DetailsContent
  })
  clearSelectedItem()
}

const handleOpenSecretChat = () => {
  // 检查是否设置了私密聊天密码
  if (!settingStore.isSecretChatConfigured()) {
    window.$message.warning(t('home.secret_chat.no_password'))
    // 可以导航到设置页面
    return
  }
  // 导航到私密聊天页面
  router.push('/secretChat')
}

/** 获取联系人数据 */
const fetchContactData = async () => {
  try {
    // 同时获取好友列表和群聊列表
    await Promise.all([contactStore.getContactList()])
  } catch (error) {
    logger.error('获取联系人数据失败:', error)
  }
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

/** 监听路由变化，当切换到消息页面时重置选中状态 */
watch(
  () => route.name,
  (newName) => {
    if (newName === SPACE_ROUTE_NAMES.workbench) {
      resetSelection()
    }
  },
  { immediate: false }
)

/** 组件挂载时获取数据 */
onMounted(async () => {
  await fetchContactData()
})

onUnmounted(() => {
  resetSelection()
})
</script>

<style scoped lang="scss">
.item-box {
  color: var(--hula-text-primary);
  .text {
    color: var(--hula-text-tertiary);
  }
  &:not(.active):hover {
    background: var(--hula-surface-list-hover);
    border-radius: 12px;
    cursor: pointer;
  }
}

.active {
  background: var(--hula-surface-session-active);
  border-radius: 12px;
  color: var(--hula-text-inverse);
  .text {
    color: var(--hula-text-inverse);
  }
}

.group-count {
  font-size: 10px;
  color: var(--hula-text-tertiary);
}

:deep(.n-collapse .n-collapse-item:not(:first-child)) {
  border: none;
}
:deep(.n-collapse .n-collapse-item) {
  margin: 6px 0 0;
}
</style>
