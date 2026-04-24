<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" room-name="公告详情" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full relative">
        <div class="flex flex-col flex-1 gap-15px py-15px px-20px">
          <div v-if="loading" class="flex justify-center items-center h-200px">
            <van-loading size="24px" />
          </div>

          <div v-else-if="announcement" class="bg-white dark:bg-dark-card rounded-15px overflow-hidden">
            <div class="p-10px">
              <div class="grid grid-cols-[2.2rem_1fr_4rem] items-start px-2 py-3 gap-1">
                <div class="self-center h-38px">
                  <van-badge>
                    <img
                      class="w-40px h-40px rounded-full object-cover"
                      :src="publisherAvatar"
                      @error="($event.target as HTMLImageElement).src = getFallbackAvatar()" />
                  </van-badge>
                </div>

                <div class="truncate pl-4 flex gap-10px flex-col">
                  <div class="text-14px leading-tight font-bold flex-1 truncate">
                    {{ publisherName }}
                  </div>
                  <span class="text-12px text-gray-400">
                    {{ formatTimestamp(announcement.createTime) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex justify-end px-10px text-12px">
              <span class="text-#13987F">{{ announcement.readCount || 0 }}人已读</span>
            </div>

            <div class="p-15px">
              {{ announcement.content }}
            </div>

            <div v-if="canEdit" class="flex justify-center pb-15px">
              <van-button type="primary" plain size="small" @click="goToNoticeEdit">编辑公告</van-button>
            </div>
          </div>

          <div v-else class="flex justify-center items-center h-200px text-#909090">公告不存在或已被删除</div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { useRoute, useRouter } from 'vue-router'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStore } from '@/stores/domains/user/user'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { matrixAnnouncementService } from '@/services/matrix'
import type { Announcement as MatrixAnnouncement } from '@/services/matrix/room/MatrixAnnouncementService'

const logger = createLogger('NoticeDetail')

defineOptions({
  name: 'mobileChatNoticeDetail'
})

const route = useRoute()
const router = useRouter()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

type NoticeDetailAnnouncement = MatrixAnnouncement & {
  uid: string
  createTime: number
  readCount?: number
}

const announcement = ref<NoticeDetailAnnouncement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const publisherName = computed(() => {
  if (!announcement.value) return '未知用户'
  const userInfo = groupStore.getUserInfo(announcement.value.uid)
  return userInfo?.name || userInfo?.myName || '未知用户'
})

const publisherAvatar = computed(() => {
  if (!announcement.value) return ''
  const userInfo = groupStore.getUserInfo(announcement.value.uid)
  return userInfo?.avatar || ''
})

const getFallbackAvatar = () => {
  return '/logo.png'
}

const canEdit = computed(() => {
  if (!announcement.value) return false

  const currentUid = userStore.userInfo?.uid
  const isPublisher = announcement.value.uid === currentUid

  const isLord = currentUid ? groupStore.isCurrentLord(currentUid) : false
  const isAdmin = currentUid ? groupStore.isAdmin(currentUid) : false
  return isPublisher || isLord || isAdmin
})

const fetchAnnouncementDetail = async () => {
  try {
    loading.value = true

    const data = await matrixAnnouncementService.getAnnouncementById(
      globalStore.currentSessionRoomId,
      route.params.id as string
    )
    if (data) {
      announcement.value = {
        ...data,
        uid: data.authorId,
        createTime: data.createdAt
      }
    }
  } catch (err) {
    logger.error('获取公告详情失败:', err)
    error.value = '获取公告详情失败，请重试'
  } finally {
    loading.value = false
  }
}

const goToNoticeEdit = () => {
  if (announcement.value) {
    router.push(`/mobile/chatRoom/notice/edit/${announcement.value.id}`)
  }
}

onMounted(() => {
  fetchAnnouncementDetail()
})
</script>

<style scoped>
.announcement-content {
  line-height: 1.6;
  max-height: none;
  overflow-y: auto;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
