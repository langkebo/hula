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
          placeholder="请输入公告内容..."
          class="w-full"
          rows="5"
          autosize
          :maxlength="1000"
          show-word-limit
          :spellcheck="false" />

        <div class="upload-image-container pt-10px">
          <div class="upload-trigger">
            <svg class="size-24px text-#999">
              <use href="#plus"></use>
            </svg>
            <span class="text-12px text-#999 mt-5px">点击上传</span>
          </div>
        </div>

        <div class="pb-10px">
          <div class="flex flex-col w-full">
            <div class="flex justify-between py-15px px-15px items-center border-b border-gray-200">
              <div class="flex flex-col">
                <div class="text-14px font-medium">设为置顶</div>
                <div class="text-12px text-gray-500 mt-5px">公告将显示在群公告列表顶部</div>
              </div>
              <van-switch v-model="top" />
            </div>
          </div>

          <div class="flex justify-center gap-15px">
            <van-button plain round size="large" class="w-40%" @click="handleCancel">取消</van-button>
            <van-button type="primary" round size="large" class="w-40%" @click="handleSubmit" :loading="submitting">
              保存
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { matrixAnnouncementService } from '@/services/matrix/room/MatrixAnnouncementService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

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
    window.$message?.error('请输入公告内容')
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
      window.$message?.success('公告修改成功')
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
      window.$message?.success('公告发布成功')
      router.back()
    }
  } catch (error) {
    logger.error('保存公告失败:', error)
    window.$message?.error('保存公告失败，请重试')
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
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  background-color: #fafafa;
  cursor: not-allowed;
}
</style>
