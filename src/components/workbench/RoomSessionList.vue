<template>
  <n-scrollbar ref="msg-scrollbar" class="h-full" style="max-height: calc(100vh / var(--page-scale, 1) - 70px)">
    <div v-if="syncLoading" class="flex-center gap-10px py-12px text-(12px [--hula-text-primary])">
      <n-spin :size="14" />
      <span>{{ t('message.message_list.sync_loading') }}</span>
    </div>

    <div
      v-if="networkBanner && !syncLoading && !globalStore.currentSessionRoomId"
      class="mx-10px mt-6px border-(1px solid [--hula-color-danger-500]) flex items-center gap-8px rounded-6px bg-[--hula-color-danger-100] px-12px py-10px text-(12px [--hula-color-danger-500])"
      style="position: sticky; top: 6px; z-index: 999">
      <svg class="size-16px flex-shrink-0">
        <use href="#cloudError"></use>
      </svg>
      <span class="leading-tight">{{ networkBanner.text }}</span>
      <button
        v-if="showRetryAction"
        type="button"
        class="ml-auto rounded-full border border-[--hula-color-danger-500] bg-transparent px-10px py-2px text-12px leading-tight color-[--hula-color-danger-500] transition-opacity hover:opacity-80"
        data-test="network-retry"
        @click="onRetryNetwork">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-if="sessionList.length > 0" class="p-[4px_10px_0px_8px] h-full">
      <RecycleScroller
        class="scroller h-full"
        :items="sessionList"
        :item-size="80"
        key-field="roomId"
        v-slot="{ item }">
        <ContextMenu
          :class="getItemClasses(item)"
          :data-key="item.roomId"
          :menu="visibleMenu(item)"
          :special-menu="visibleSpecialMenu(item)"
          :content="item"
          class="msg-box w-full h-75px mb-5px"
          @click="onMsgClick(item)"
          @dblclick="onMsgDblclick(item)"
          @select="$event.click(item)"
          @menu-show="onMenuShow(item.roomId, $event)">
          <n-flex :size="10" align="center" class="h-75px pl-6px pr-8px flex-1">
            <n-avatar
              style="border: 1px solid var(--avatar-border-color)"
              :size="44"
              :color="avatarColor"
              :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              :src="AvatarUtils.getAvatarUrl(item.avatar)"
              round />

            <n-flex class="h-fit flex-1 truncate" justify="space-between" vertical>
              <n-flex :size="4" align="center" class="flex-1 truncate" justify="space-between">
                <n-flex :size="0" align="center" class="leading-tight flex-1 truncate">
                  <span class="text-14px leading-tight flex-1 truncate">{{ item.name }}</span>
                  <n-popover trigger="hover" v-if="item.hotFlag === IsAllUserEnum.Yes">
                    <template #trigger>
                      <svg
                        :style="getOfficialIconStyle(item.roomId)"
                        class="size-20px select-none outline-none cursor-pointer">
                        <use href="#auth"></use>
                      </svg>
                    </template>
                    <span>{{ t('message.message_list.official_popover') }}</span>
                  </n-popover>

                  <n-popover trigger="hover" v-if="item.account === UserType.BOT">
                    <template #trigger>
                      <svg class="size-20px select-none outline-none cursor-pointer color-[--hula-color-primary-500]">
                        <use href="#authenticationUser"></use>
                      </svg>
                    </template>
                    <span>{{ t('message.message_list.bot_popover') }}</span>
                  </n-popover>
                </n-flex>
                <span
                  v-if="item.account !== UserType.BOT"
                  :style="getTimeStyle(item)"
                  class="text text-10px w-fit truncate text-right">
                  {{ item.lastMsgTime }}
                </span>
              </n-flex>

              <n-flex align="center" justify="space-between">
                <template v-if="item.isAtMe">
                  <span class="text flex-1 leading-tight text-12px truncate">
                    <span class="text-[--hula-color-danger-500] mr-4px">
                      {{ t('message.message_list.mention_tag') }}
                    </span>
                    <span>{{ String(item.lastMsg || '').replace(':', '：') }}</span>
                  </span>
                </template>
                <template v-else-if="item.shield">
                  <span class="text flex-1 leading-tight text-12px truncate">
                    <span :style="getShieldTextStyle(item.roomId)">
                      {{
                        item.type === RoomTypeEnum.GROUP
                          ? t('message.message_list.shield_group')
                          : t('message.message_list.shield_user')
                      }}
                    </span>
                  </span>
                </template>
                <template v-else>
                  <span :class="['text flex-1 leading-tight text-12px truncate']">
                    <span :style="getPreviewTextStyle(item)">
                      {{ String(item.lastMsg || t('message.message_list.default_last_msg')).replace(':', '：') }}
                    </span>
                  </span>
                </template>

                <template v-if="item.shield">
                  <svg :style="getShieldAccentStyle(item.roomId)" class="size-14px">
                    <use href="#forbid"></use>
                  </svg>
                </template>
                <template v-else-if="item.muteNotification === 1 && !item.unreadCount">
                  <svg :style="getMutedIconStyle(item.roomId)" class="size-14px">
                    <use href="#close-remind"></use>
                  </svg>
                </template>
                <n-badge
                  v-else
                  :max="99"
                  :value="item.unreadCount"
                  :show="globalStore.unreadReady && item.unreadCount > 0"
                  :color="item.muteNotification === 1 ? mutedBadgeColor : undefined" />
              </n-flex>
            </n-flex>
          </n-flex>
        </ContextMenu>
      </RecycleScroller>
    </div>

    <n-flex
      v-else-if="sessionLoading"
      vertical
      :size="18"
      style="max-height: calc(100vh / var(--page-scale, 1) - 70px)"
      class="relative h-100vh box-border p-20px">
      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex justify="end">
        <n-skeleton style="border-radius: 14px" height="40px" width="80%" :sharp="false" />
      </n-flex>

      <n-flex>
        <n-skeleton style="border-radius: 14px" height="60px" width="100%" :sharp="false" />
      </n-flex>
    </n-flex>

    <n-result v-else class="absolute-center" status="418" :description="emptyDescription" />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RecycleScroller } from 'vue-virtual-scroller'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { RoomTypeEnum, ThemeEnum, UserType } from '@/enums'
import { IsAllUserEnum } from '@/services/types'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

type SessionListItem = SessionItem & {
  lastMsg?: string
  lastMsgTime?: string
  isAtMe?: boolean
}

const { t } = useI18n()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const msgScrollbar = useTemplateRef<HTMLElement>('msg-scrollbar')
const mutedBadgeColor = 'var(--hula-text-disabled)'
const props = defineProps<{
  sessionList: SessionListItem[]
  syncLoading: boolean
  sessionLoading: boolean
  networkBanner: { text: string; retryable?: boolean } | null
  emptyDescription: string
  getItemClasses: (item: SessionItem) => Record<string, boolean>
  visibleMenu: (item: SessionItem) => OPT.RightMenu[]
  visibleSpecialMenu: (item: SessionItem) => OPT.RightMenu[]
  onMsgClick: (item: SessionItem) => void | Promise<void>
  onMsgDblclick: (item: SessionItem) => void
  onMenuShow: (roomId: string, isShow: boolean) => void
  onRetryNetwork?: () => void | Promise<void>
}>()

const avatarColor = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '' : 'var(--hula-text-inverse)'))
const showRetryAction = computed(() => Boolean(props.networkBanner?.retryable && props.onRetryNetwork))

const getOfficialIconStyle = (roomId: string) => ({
  color: globalStore.currentSessionRoomId === roomId ? 'var(--hula-color-primary-100)' : 'var(--hula-color-primary-500)'
})

const getShieldAccentStyle = (roomId: string) => ({
  color: globalStore.currentSessionRoomId === roomId ? 'var(--hula-color-danger-500)' : 'var(--hula-text-tertiary)'
})

const getMutedIconStyle = (roomId: string) => ({
  color: globalStore.currentSessionRoomId === roomId ? 'var(--hula-text-inverse)' : 'var(--hula-text-tertiary)'
})

const getPreviewTextStyle = (item: SessionListItem) =>
  item.account === UserType.BOT ? { color: 'var(--hula-text-secondary)' } : undefined

const getTimeStyle = (item: SessionListItem) => {
  if (!(item.shield && globalStore.currentSessionRoomId === item.roomId)) {
    return undefined
  }

  return {
    color: 'var(--hula-color-danger-500)',
    opacity: '0.9'
  }
}

const getShieldTextStyle = (roomId: string) => ({
  color:
    globalStore.currentSessionRoomId === roomId
      ? 'color-mix(in srgb, var(--hula-color-danger-500) 90%, transparent)'
      : 'var(--hula-text-tertiary)'
})

const scrollToIndex = async (index: number) => {
  if (index < 0) return

  await nextTick()
  msgScrollbar.value?.scrollTo({
    top: index * (75 + 5) - 264,
    behavior: 'smooth'
  })
}

defineExpose({
  scrollToIndex
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/message';
</style>
