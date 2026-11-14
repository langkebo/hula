<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" :room-name="t('mobile_chat.notice.title')" />
    </template>

    <template #container>
      <div ref="scrollContainerRef" class="flex flex-col overflow-auto h-full" @scroll.passive="handleScroll">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <!-- 空态：群里没有公告时给出明确出路，避免只剩一块空白 -->
          <div
            v-if="listLoaded && announList.length === 0"
            class="flex flex-col items-center justify-center gap-12px py-60px text-[--tjg-text-secondary]">
            <svg
              class="w-40px h-40px text-[--tjg-text-quaternary]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path
                d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z" />
              <path d="M8 9h8M8 12h5" />
            </svg>
            <p class="text-14px">{{ t('mobile_chat.notice.empty') }}</p>
            <van-button v-if="canAddAnnouncement" size="small" type="primary" round @click="goToAddNotice">
              {{ t('mobile_chat.notice.publish') }}
            </van-button>
          </div>

          <RecycleScroller
            v-else-if="announList.length > 0"
            :items="announList"
            :item-size="120"
            key-field="id"
            class="flex flex-col">
            <template #default="{ item }">
              <div class="bg-[--tjg-surface-panel] rounded-10px p-15px">
                <div v-clickable @click="goToNoticeDetail(item.id)">
                  <div class="flex flex-col w-full gap-10px">
                    <div class="flex items-center justify-between text-14px">
                      <span class="flex gap-5px items-center min-w-0">
                        <span
                          v-if="isUnread(item.id)"
                          class="notice-unread-dot"
                          :aria-label="t('mobile_chat.notice.unread')" />
                        <span class="text-[--tjg-text-secondary]">{{ t('mobile_chat.notice.publisher') }}</span>
                        <span class="text-black dark:text-white/80 truncate">
                          {{ groupStore.getUserInfo(item.uid)?.name }}
                        </span>
                      </span>
                      <span
                        v-if="item.top"
                        class="text-[--tjg-color-primary-500] rounded-15px px-7px py-5px text-12px border-[1px] border-solid border-[--tjg-color-primary-500]">
                        {{ t('mobile_chat.notice.pinned') }}
                      </span>
                    </div>
                    <div class="text-14px line-clamp-3 line-height-20px text-[--tjg-text-secondary] max-h-60px">
                      {{ item.content }}
                    </div>

                    <div class="flex items-center justify-between text-12px">
                      <span class="flex gap-5px text-[--tjg-text-secondary]">
                        {{ formatChatTime(item.createTime) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </RecycleScroller>
        </div>

        <van-floating-bubble v-if="canAddAnnouncement" axis="xy" magnetic="x" @click="goToAddNotice">
          <template #default>
            <svg class="w-24px h-24px iconpark-icon text-white" aria-hidden="true"><use href="#plus"></use></svg>
          </template>
        </van-floating-bubble>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { RecycleScroller } from 'vue-virtual-scroller'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const logger = createLogger('NoticeList')

defineOptions({
  name: 'mobileChatNoticeList'
})

const route = useRoute()
const router = useRouter()
const announList = ref<GroupAnnouncementListItem[]>([])
const groupStore = useGroupStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const announcementStore = useAnnouncementStore()

type GroupAnnouncementListResponse = Awaited<ReturnType<typeof announcementStore.getGroupAnnouncementList>>
type GroupAnnouncementListItem = GroupAnnouncementListResponse['records'][number]

/**
 * 列表页没有 keep-alive：从公告详情返回会整页重建。
 * 滚动位置按房间号存在模块级 Map 里（不随组件销毁丢失），重建后再回填。
 */
const SCROLL_TOP_BY_ROOM = new Map<string, number>()
const scrollContainerRef = ref<HTMLElement | null>(null)

/**
 * 公告暂无服务端已读状态（R-11），先用本地记录标记已读/未读。
 * 换设备或清缓存后重置，属于已知降级，不伪造服务端统计。
 */
const READ_STORAGE_PREFIX = 'hula.mobile.notice.read.'
const listLoaded = ref(false)
const readIds = ref<Set<string>>(new Set())

const resolveScrollKey = () => String(globalStore.currentSessionRoomId || route.params.roomId || '')

const handleScroll = () => {
  const el = scrollContainerRef.value
  const key = resolveScrollKey()
  if (el && key) {
    SCROLL_TOP_BY_ROOM.set(key, el.scrollTop)
  }
}

const restoreScroll = async () => {
  const top = SCROLL_TOP_BY_ROOM.get(resolveScrollKey())
  if (!top) return
  await nextTick()
  const el = scrollContainerRef.value
  if (el) {
    el.scrollTop = top
  }
}

const readStorageKey = () => `${READ_STORAGE_PREFIX}${resolveScrollKey()}`

const loadReadIds = () => {
  try {
    const raw = localStorage.getItem(readStorageKey())
    const parsed: unknown = raw ? JSON.parse(raw) : []
    readIds.value = new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    readIds.value = new Set()
  }
}

const persistReadIds = () => {
  try {
    localStorage.setItem(readStorageKey(), JSON.stringify([...readIds.value]))
  } catch {
    // 存储受限时仅保留内存态，不阻断查看
  }
}

const isUnread = (id: string) => !readIds.value.has(id)

const markNoticeRead = (id: string) => {
  if (!id || readIds.value.has(id)) return
  readIds.value.add(id)
  persistReadIds()
}

const sortAnnouncements = (list: GroupAnnouncementListItem[]) => {
  const topAnnouncement = list.find((item) => item.top)
  if (!topAnnouncement) {
    return list
  }
  return [topAnnouncement, ...list.filter((item) => !item.top)]
}

const canAddAnnouncement = computed(() => {
  if (!userStore.userInfo?.uid) return false

  const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
  const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

  return isLord || isAdmin
})

const loadAnnouncementList = async () => {
  try {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) {
      logger.error('No roomId for current session')
      return
    }

    const data = await announcementStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data?.records) {
      announList.value = sortAnnouncements(data.records)
      void restoreScroll()
    }
  } catch (error) {
    logger.error('Failed to load group announcements:', error)
  } finally {
    listLoaded.value = true
  }
}

const goToNoticeDetail = (id: string) => {
  markNoticeRead(id)
  router.push(`/mobile/chatRoom/notice/detail/${id}`)
}

const goToAddNotice = () => {
  router.push('/mobile/chatRoom/notice/add')
}

onMounted(() => {
  loadReadIds()
  // 深链参数可能被手工构造或截断，解析失败时回退到接口加载，避免白屏。
  const rawAnnouncements = route.query.announList
  if (typeof rawAnnouncements === 'string' && rawAnnouncements) {
    try {
      const parsed = JSON.parse(rawAnnouncements) as unknown
      if (Array.isArray(parsed)) {
        announList.value = sortAnnouncements(parsed as GroupAnnouncementListItem[])
        listLoaded.value = true
        void restoreScroll()
        return
      }
      logger.warn('Ignored malformed announList route query')
    } catch (error) {
      logger.warn('Failed to parse announList route query:', error)
    }
  }
  loadAnnouncementList()
})

onActivated(() => {
  loadAnnouncementList()
})

onBeforeUnmount(() => {
  handleScroll()
})
</script>

<style scoped>
.notice-unread-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: var(--tjg-radius-full);
  background-color: var(--tjg-color-danger-500);
}
</style>
