<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        border
        :hidden-right="true"
        :room-name="isEditMode ? '编辑群公告' : '新增群公告'" />
    </template>

    <template #container>
      <div class="h-full p-10px">
        <van-field
          v-model="announcementContent"
          type="textarea"
          :placeholder="t('mobile_chat.notice.content_placeholder')"
          class="w-full"
          rows="5"
          autosize
          :maxlength="1000"
          show-word-limit
          :spellcheck="false" />

        <div class="upload-image-container pt-10px">
          <div class="upload-trigger">
            <svg class="size-24px text-[--hula-text-tertiary]">
              <use href="#plus"></use>
            </svg>
            <span class="text-12px text-[--hula-text-tertiary] mt-5px">{{ t('mobile_chat.notice.click_upload') }}</span>
          </div>
        </div>

        <div class="pb-10px">
          <div class="flex flex-col w-full">
            <div class="flex justify-between py-15px px-15px items-center border-b border-gray-200">
              <div class="flex flex-col">
                <div class="text-14px font-medium">{{ t('mobile_chat.notice.set_pinned') }}</div>
                <div class="text-12px text-gray-500 mt-5px">{{ t('mobile_chat.notice.pinned_desc') }}</div>
              </div>
              <van-switch v-model="top" />
            </div>
          </div>

          <div class="flex justify-center gap-15px">
            <van-button plain round size="large" class="w-40%" @click="handleCancel">
              {{ t('mobile_chat.notice.cancel') }}
            </van-button>
            <van-button type="primary" round size="large" class="w-40%" @click="handleSubmit" :loading="submitting">
              {{ t('mobile_chat.notice.save') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixAnnouncementService } from '@/services/matrix/room/MatrixAnnouncementService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('NoticeEdit')

defineOptions({
  name: 'mobileChatNoticeEdit'
})

const route = useRoute()
const router = useRouter()
const globalStore = useGlobalStore()

const isEditMode = computed(() => !!route.params.id)

const announcementContent = ref('')
const top = ref(false)
const submitting = ref(false)

const loadAnnouncementDetail = async () => {
  if (!isEditMode.value) {
    return
  }

  try {
    const data = await matrixAnnouncementService.getAnnouncementById(
      globalStore.currentSessionRoomId,
      route.params.id as string
    )

    if (data) {
      announcementContent.value = data.content
      top.value = data.isPinned
    }
    logger.debug('announcementContent ', announcementContent)
  } catch (error) {
    logger.error('加载公告详情失败:', error)
  }
}

const handleCancel = () => {
  router.back()
}

const handleSubmit = async () => {
  if (!announcementContent.value.trim()) {
    showFeedback(t('mobile_chat.notice.content_required'), 'error')
    return
  }

  submitting.value = true

  try {
    if (isEditMode.value) {
      const announcementData = {
        id: route.params.id as string,
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await matrixAnnouncementService.editAnnouncement(announcementData.roomId, {
        id: announcementData.id,
        content: announcementData.content,
        isPinned: announcementData.top
      })
      showFeedback('公告修改成功', 'success')
      router.push({
        path: `/mobile/chatRoom/notice/detail/${announcementData.id}`
      })
    } else {
      const announcementData = {
        roomId: (route.query.roomId as string) || globalStore.currentSessionRoomId,
        content: announcementContent.value,
        top: top.value
      }

      await matrixAnnouncementService.pushAnnouncement(announcementData.roomId, {
        content: announcementData.content,
        isPinned: announcementData.top
      })
      showFeedback('公告发布成功', 'success')
      router.back()
    }
  } catch (error) {
    logger.error('保存公告失败:', error)
    showFeedback(t('mobile_chat.notice.save_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadAnnouncementDetail()
})
</script>

<style scoped>
.upload-image-container {
  width: 100%;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  border: 1px dashed var(--hula-border-default);
  border-radius: 8px;
  background-color: var(--hula-surface-panel-muted);
  cursor: not-allowed;
}
</style>
