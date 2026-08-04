<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" :room-name="t('mobile_chat.notice.detail_title')" />
    </template>

    <template #container>
      <div class="h-full overflow-auto bg-[--tjg-page-bg-color] px-16px py-12px">
        <div v-if="loading" class="notice-detail__state">
          <van-loading size="24px" />
        </div>

        <div v-else-if="announcement" class="notice-detail__card">
          <div class="flex items-start justify-between gap-12px">
            <div class="flex flex-col gap-8px">
              <div class="flex items-center gap-8px">
                <span class="text-15px font-600 text-[--tjg-text-primary]">
                  {{ t('mobile_chat.notice.detail_title') }}
                </span>
                <span v-if="announcement.isPinned" class="notice-detail__pinned">
                  {{ t('mobile_chat.notice.pinned') }}
                </span>
              </div>
              <span class="text-12px text-[--tjg-text-secondary]">
                {{ t('mobile_chat.notice.publisher') }} {{ publisherName }}
              </span>
              <span class="text-12px text-[--tjg-text-tertiary]">
                {{ formatTimestamp(announcement.createdAt) }}
              </span>
            </div>

            <van-button plain size="small" type="primary" @click="goToEdit">
              {{ t('mobile_chat.notice.edit_notice') }}
            </van-button>
          </div>

          <div class="notice-detail__content">
            {{ announcement.content || t('mobile_chat.notice.not_found') }}
          </div>
        </div>

        <div v-else class="notice-detail__state">
          <van-empty :description="t('mobile_chat.notice.not_found')" />
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type Announcement, matrixAnnouncementService } from '@/services/matrix/room/MatrixAnnouncementService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('NoticeDetail')

defineOptions({
  name: 'mobileChatNoticeDetail'
})

const route = useRoute()
const router = useRouter()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()

const loading = ref(false)
const announcement = ref<Announcement | null>(null)

const roomId = computed(() => String(route.query.roomId || globalStore.currentSessionRoomId || ''))
const announcementId = computed(() => String(route.params.id || ''))

const publisherName = computed(() => {
  const authorId = announcement.value?.authorId
  if (!authorId) {
    return t('mobile_chat.notice.unknown_user')
  }

  return groupStore.getUserInfo(authorId)?.name || authorId || t('mobile_chat.notice.unknown_user')
})

const loadAnnouncementDetail = async () => {
  if (!roomId.value || !announcementId.value) {
    announcement.value = null
    return
  }

  loading.value = true
  try {
    announcement.value = await matrixAnnouncementService.getAnnouncementById(roomId.value, announcementId.value)
    if (!announcement.value) {
      showFeedback(t('mobile_chat.notice.not_found'), 'warning')
    }
  } catch (error) {
    logger.error('加载公告详情失败:', error)
    announcement.value = null
    showFeedback(t('mobile_chat.notice.fetch_failed'), 'error')
  } finally {
    loading.value = false
  }
}

const goToEdit = () => {
  if (!announcement.value) {
    return
  }

  router.push({
    path: `/mobile/chatRoom/notice/edit/${announcement.value.id}`,
    query: {
      roomId: roomId.value
    }
  })
}

onMounted(() => {
  loadAnnouncementDetail()
})
</script>

<style scoped>
.notice-detail__card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 12px;
  background: var(--tjg-surface-panel);
}

.notice-detail__pinned {
  padding: 2px 8px;
  border: 1px solid var(--tjg-color-primary-500);
  border-radius: 999px;
  color: var(--tjg-color-primary-500);
  font-size: 12px;
  line-height: 18px;
}

.notice-detail__content {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--tjg-text-primary);
  font-size: 14px;
  line-height: 1.7;
}

.notice-detail__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}
</style>
