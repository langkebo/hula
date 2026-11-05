<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" :room-name="t('mobile_chat.notice.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <RecycleScroller :items="announList" :item-size="120" key-field="id" class="flex flex-col">
            <template #default="{ item }">
              <div class="bg-[--tjg-surface-panel] rounded-10px p-15px">
                <div @click="goToNoticeDetail(item.id)">
                  <div class="flex flex-col w-full gap-10px">
                    <div class="flex items-center justify-between text-14px">
                      <span class="flex gap-5px">
                        <span class="text-[--tjg-text-secondary]">{{ t('mobile_chat.notice.publisher') }}</span>
                        <span class="text-black dark:text-white/80">{{ groupStore.getUserInfo(item.uid)?.name }}</span>
                      </span>
                      <span
                        v-if="item.isTop"
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
                      <span class="text-[--tjg-color-primary-500]">
                        {{ t('mobile_chat.notice.read_count', { count: 128 }) }}
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
            <svg class="w-24px h-24px iconpark-icon text-white"><use href="#plus"></use></svg>
          </template>
        </van-floating-bubble>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { onActivated } from 'vue'
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
    }
  } catch (error) {
    logger.error('Failed to load group announcements:', error)
  }
}

const goToNoticeDetail = (id: string) => {
  logger.debug('Navigate to notice detail page, notice ID:', id)
  router.push(`/mobile/chatRoom/notice/detail/${id}`)
}

const goToAddNotice = () => {
  logger.debug('Navigate to add notice page')
  router.push('/mobile/chatRoom/notice/add')
}

onMounted(() => {
  // 深链参数可能被手工构造或截断，解析失败时回退到接口加载，避免白屏。
  const rawAnnouncements = route.query.announList
  if (typeof rawAnnouncements === 'string' && rawAnnouncements) {
    try {
      const parsed = JSON.parse(rawAnnouncements) as unknown
      if (Array.isArray(parsed)) {
        announList.value = sortAnnouncements(parsed as GroupAnnouncementListItem[])
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
</script>

<style scoped></style>
