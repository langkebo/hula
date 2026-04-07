<template>
  <!-- 好友详情 -->
  <n-flex v-if="content.type === RoomTypeEnum.SINGLE" vertical align="center" :size="30" class="mt-60px">
    <n-image
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      width="146"
      height="146"
      style="border: 2px solid #fff"
      class="rounded-50% select-none cursor-pointer"
      :src="AvatarUtils.getAvatarUrl(item.avatar)"
      @dblclick="openImageViewer"
      alt="" />

    <span class="text-(20px [--text-color])">{{ item.name }}</span>

    <template v-if="!isBotUser">
      <span class="text-(14px #909090)">{{ t('home.chat_details.single.empty_signature') }}</span>

      <n-flex align="center" justify="space-between" :size="30" class="text-#606060 select-none cursor-default">
        <span>
          {{
            t('home.chat_details.single.region', {
              place: item.locPlace || t('home.chat_details.single.unknown')
            })
          }}
        </span>
        <n-flex align="center">
          <span>{{ t('home.chat_details.single.badge_label') }}</span>
          <template v-for="badge in item.itemIds" :key="badge">
            <n-popover trigger="hover">
              <template #trigger>
                <img class="size-34px" :src="badgeStore.badgeById(badge)?.img" alt="" />
              </template>
              <span>{{ badgeStore.badgeById(badge)?.describe }}</span>
            </n-popover>
          </template>
        </n-flex>
      </n-flex>
      <!-- 选项按钮 -->
      <n-flex align="center" justify="space-between" :size="60">
        <n-icon-wrapper
          v-for="(opt, index) in footerOptions"
          :key="index"
          :size="60"
          :border-radius="10"
          :color="'var(--text-color)'"
          @click="opt.onClick">
          <n-tooltip>
            <template #trigger>
              <n-icon :size="24" :component="opt.icon" />
            </template>
            {{ opt.label }}
          </n-tooltip>
        </n-icon-wrapper>
      </n-flex>
    </template>
  </n-flex>

  <!-- 群组详情 -->
  <n-flex v-else-if="content.type === RoomTypeEnum.GROUP" vertical align="center" :size="20" class="mt-30px">
    <!-- 群头像 -->
    <n-image
      object-fit="cover"
      show-toolbar-tooltip
      preview-disabled
      width="120"
      height="120"
      style="border: 2px solid #fff"
      class="rounded-12px select-none cursor-pointer"
      :src="AvatarUtils.getAvatarUrl(item.avatar)"
      @dblclick="openImageViewer"
      alt="" />

    <!-- 群名称 -->
    <span class="text-(18px [--text-color])">{{ item.name }}</span>

    <!-- 群公告 -->
    <div v-if="announcementContent" class="announcement-container">
      <div class="announcement-header">
        <span class="text-14px">{{ t('home.chat_details.group.announcement.label') }}</span>
        <n-button text type="primary" size="small" @click="handleOpenAnnouncement">
          {{ t('home.chat_details.group.announcement.view_all') }}
        </n-button>
      </div>
      <div class="announcement-content">{{ announcementContent }}</div>
    </div>

    <!-- 群成员 -->
    <div class="member-section">
      <div class="member-header">
        <span>{{ t('home.chat_details.group.members', { count: memberCount }) }}</span>
      </div>
      <n-grid :cols="4" :x-gap="12" :y-gap="12">
        <n-gi v-for="member in displayMembers" :key="member.uid">
          <div class="member-item" @click="handleMemberClick(member)">
            <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar)" :size="40" />
            <span class="member-name">{{ member.name }}</span>
          </div>
        </n-gi>
      </n-grid>
    </div>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import { useGroupStore } from '@/stores/group'
import { useBadgeStore } from '@/stores/badge'
import { RoomTypeEnum, UserType } from '@/enums'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createWebviewWindow } from '@/hooks/useWindow'
import { resolveMyRoomNickname } from '@/utils/RoomUtils'
import { createLogger } from '@/utils/Logger'
import type { PropType } from 'vue'

const logger = createLogger('Details')
const { t } = useI18n()
const groupStore = useGroupStore()
const badgeStore = useBadgeStore()

const props = defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: true
  }
})

const item = ref<any>({})
const announcementContent = ref('')
const remarkSnapshot = ref('')
const nicknameSnapshot = ref('')

const fetchAnnouncement = async (_roomId: string) => {
  try {
    announcementContent.value = ''
  } catch (error) {
    logger.error('获取群公告失败:', error)
    announcementContent.value = ''
  }
}

const handleOpenAnnouncement = async () => {
  if (!item.value?.roomId) return
  await createWebviewWindow(
    t('home.chat_details.group.announcement.window_title'),
    `announList/${item.value.roomId}/1`,
    420,
    620
  )
}

const displayNickname = computed(() =>
  resolveMyRoomNickname({ roomId: item.value?.roomId, myName: item.value?.myName })
)

const isBotUser = computed(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !item.value?.uid) return false
  return groupStore.getUserInfo(item.value.uid)?.account === UserType.BOT
})

watchEffect(async () => {
  if (!props.content.uid) {
    item.value = {}
    remarkSnapshot.value = ''
    nicknameSnapshot.value = ''
    announcementContent.value = ''
  } else {
    try {
      const response = await groupStore.loadGroupInfo(props.content.uid)
      item.value = response || {}
    } catch (e) {
      logger.error('获取群组详情失败:', e)
    }
  }
})

const memberCount = computed(() => groupStore.userList.length || 0)
const displayMembers = computed(() => groupStore.userList.slice(0, 8))

const handleMemberClick = (member: any) => {
  logger.debug('点击成员:', member.uid)
}

const openImageViewer = () => {
  logger.debug('打开图片查看器')
}

const footerOptions = computed(() => [
  {
    icon: null,
    label: t('home.chat_details.single.send_message'),
    onClick: () => handleSendMessage()
  }
])

const handleSendMessage = () => {
  logger.debug('发送消息')
}
</script>

<style scoped lang="scss">
.announcement-container {
  width: 100%;
  padding: 12px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.announcement-content {
  font-size: 13px;
  color: var(--text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.member-section {
  width: 100%;
}

.member-header {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--text-color-secondary);
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-color-hover);
  }
}

.member-name {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-color);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
