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
                        class="text-[--tjg-color-primary-500] rounded-15px px-7px py-5px text-12px"
                        style="border: 1px solid; border-color: var(--tjg-color-primary-500)">
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
      logger.error('当前会话没有roomId')
      return
    }

    const data = await announcementStore.getGroupAnnouncementList(roomId, 1, 10)
    if (data?.records) {
      announList.value = sortAnnouncements(data.records)
    }
  } catch (error) {
    logger.error('加载群公告失败:', error)
  }
}

const goToNoticeDetail = (id: string) => {
  logger.debug(`跳转到公告详情页面，公告ID: ${id}`)
  router.push(`/mobile/chatRoom/notice/detail/${id}`)
}

const goToAddNotice = () => {
  logger.debug('跳转到新增公告页面')
  router.push('/mobile/chatRoom/notice/add')
}

onMounted(() => {
  if (route.query.announList) {
    announList.value = sortAnnouncements(JSON.parse(route.query.announList as string) as GroupAnnouncementListItem[])
  } else {
    loadAnnouncementList()
  }
})

onActivated(() => {
  loadAnnouncementList()
})
</script>

<style scoped></style>
