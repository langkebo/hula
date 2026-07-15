<template>
  <div class="announcement-panel flex flex-col h-full">
    <n-flex align="center" justify="space-between" class="px-4px py-8px">
      <span class="text-(14px [--hula-text-primary]) truncate flex-1 min-w-0">
        {{ isEditing ? t('announcement.title.create') : t('announcement.title.view') }}
      </span>
      <n-flex align="center" :size="4">
        <n-button v-if="isAdmin && !isEditing" size="tiny" secondary @click="startNew">
          {{ t('announcement.form.actions.new') }}
        </n-button>
        <n-button size="tiny" quaternary @click="$emit('close')">
          <template #icon>
            <svg class="size-14px"><use href="#close"></use></svg>
          </template>
        </n-button>
      </n-flex>
    </n-flex>

    <div v-if="isEditing" class="flex-1 flex flex-col px-4px overflow-hidden">
      <n-input
        v-model:value="editContent"
        type="textarea"
        :placeholder="t('announcement.form.placeholder')"
        :autosize="{ minRows: 6, maxRows: 12 }"
        maxlength="600"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        show-count
        autofocus
        class="flex-1" />
      <n-flex justify="space-between" align="center" class="py-8px">
        <n-flex align="center" :size="6">
          <n-switch v-model:value="isPinned" size="small" />
          <span class="text-(12px [--hula-text-secondary])">{{ t('announcement.form.pinned') }}</span>
        </n-flex>
        <n-flex align="center" :size="6">
          <n-button size="tiny" quaternary @click="cancelEdit">
            {{ t('announcement.form.actions.cancel') }}
          </n-button>
          <n-button size="tiny" type="primary" secondary :loading="publishing" @click="handlePublish">
            {{ t('announcement.form.actions.publish') }}
          </n-button>
        </n-flex>
      </n-flex>
    </div>

    <div v-else class="flex-1 overflow-hidden">
      <n-scrollbar class="h-full">
        <div v-if="loading" class="flex-center py-20px">
          <n-spin size="small" />
        </div>

        <div v-else-if="announcements.length === 0" class="flex-center py-20px">
          <n-empty :description="t('announcement.list.empty')" size="small">
            <template #icon>
              <svg class="size-20px"><use href="#explosion"></use></svg>
            </template>
          </n-empty>
        </div>

        <div v-else class="px-4px pb-12px">
          <div
            v-for="item in announcements"
            :key="item.id"
            class="py-8px border-b-(1px solid [--hula-border-muted]) last:border-b-0">
            <n-flex align="center" justify="space-between" :size="6" class="mb-4px">
              <n-flex align="center" :size="6">
                <n-avatar round :size="22" :src="getAvatar(item.author)" />
                <span class="text-(11px [--hula-text-secondary])">{{ getUserName(item.author) }}</span>
                <span class="text-(10px [--hula-text-tertiary])">{{ formatTime(item.timestamp) }}</span>
              </n-flex>
              <n-flex align="center" :size="4">
                <span
                  v-if="item.top"
                  class="px-4px py-1px bg-[--hula-color-primary-100] text-(10px [--hula-color-primary-600]) rounded-3px">
                  {{ t('announcement.form.pinned') }}
                </span>
                <n-button v-if="isAdmin" size="tiny" quaternary @click="startEdit(item)">
                  <template #icon>
                    <svg class="size-12px"><use href="#edit"></use></svg>
                  </template>
                </n-button>
                <n-popconfirm v-if="isAdmin" @positive-click="handleDelete(item)">
                  <template #trigger>
                    <n-button size="tiny" quaternary>
                      <template #icon>
                        <svg class="size-12px"><use href="#delete"></use></svg>
                      </template>
                    </n-button>
                  </template>
                  {{ t('announcement.list.deleteConfirm') }}
                </n-popconfirm>
              </n-flex>
            </n-flex>
            <p class="text-(12px [--hula-text-primary]) ws-pre-wrap line-height-tight break-words select-text">
              <template v-for="(seg, i) in extractSegments(item.content || '')" :key="i">
                <span
                  v-if="seg.isLink"
                  class="text-[--hula-color-primary-500] cursor-pointer hover:underline"
                  @click.stop="openUrl(seg.text)">
                  {{ seg.text }}
                </span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </p>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitTo } from '@tauri-apps/api/event'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { extractLinkSegments, openExternalUrl } from '@/composables/common/useLinkSegments'
import { matrixAnnouncementService } from '@/services/matrix/room/MatrixAnnouncementService'
import type { Announcement } from '@/stores/domains/chat/announcement'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AnnouncementPanel')

const props = defineProps<{
  roomId: string
}>()

defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()
const announcementStore = useAnnouncementStore()
const userStore = useUserStore()

const announcements = ref<Announcement[]>([])
const loading = ref(false)
const isEditing = ref(false)
const editContent = ref('')
const isPinned = ref(false)
const publishing = ref(false)
const editingId = ref<string | null>(null)

const isAdmin = computed(() => {
  const uid = userStore.userInfo?.uid
  if (!uid) return false
  return uid === groupStore.currentLordId || groupStore.adminUidList.includes(uid)
})

const getAvatar = (uid: string) => {
  const info = groupStore.getUserInfo(uid)
  return info?.avatar ? AvatarUtils.getAvatarUrl(info.avatar) : ''
}

const getUserName = (uid: string) => {
  const info = groupStore.getUserInfo(uid)
  return info?.name || ''
}

const formatTime = (timestamp?: number) => formatTimestamp(timestamp ?? 0, true)

const extractSegments = (content: string) => extractLinkSegments(content)
const openUrl = (url: string) => openExternalUrl(url)

const loadAnnouncements = async () => {
  if (!props.roomId) return
  loading.value = true
  try {
    const data = await announcementStore.getGroupAnnouncementList(props.roomId, 1, 20)
    if (data?.records) {
      announcements.value = data.records.sort((a: Announcement, b: Announcement) => {
        if (a.top && !b.top) return -1
        if (!a.top && b.top) return 1
        return 0
      })
    }
  } catch (err) {
    logger.error(`加载公告失败: ${err}`)
  } finally {
    loading.value = false
  }
}

const startNew = () => {
  editContent.value = ''
  isPinned.value = false
  editingId.value = null
  isEditing.value = true
}

const startEdit = (item: Announcement) => {
  editContent.value = item.content
  isPinned.value = item.top
  editingId.value = item.id
  isEditing.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  editContent.value = ''
  editingId.value = null
}

const handlePublish = async () => {
  if (!editContent.value.trim()) {
    showFeedback(t('announcement.toast.contentRequired'), 'warning')
    return
  }

  publishing.value = true
  try {
    if (editingId.value) {
      await matrixAnnouncementService.editAnnouncement(props.roomId, {
        id: editingId.value,
        content: editContent.value,
        isPinned: isPinned.value
      })
    } else {
      await matrixAnnouncementService.pushAnnouncement(props.roomId, {
        content: editContent.value,
        isPinned: isPinned.value
      })
    }

    showFeedback(
      editingId.value ? t('announcement.toast.editSuccess') : t('announcement.toast.createSuccess'),
      'success'
    )
    isEditing.value = false
    await loadAnnouncements()

    const topItem = announcements.value.find((a) => a.top)
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announcements.value.length > 0,
      topAnnouncement: topItem || null
    })
  } catch (err) {
    logger.error(`发布公告失败: ${err}`)
    showFeedback(editingId.value ? t('announcement.toast.editFail') : t('announcement.toast.createFail'), 'error')
  } finally {
    publishing.value = false
  }
}

const handleDelete = async (item: Announcement) => {
  try {
    await matrixAnnouncementService.deleteAnnouncement(props.roomId, item.id)
    await loadAnnouncements()

    if (announcements.value.length === 0) {
      await emitTo('home', 'announcementClear')
    }

    const topItem = announcements.value.find((a) => a.top)
    await emitTo('home', 'announcementUpdated', {
      hasAnnouncements: announcements.value.length > 0,
      topAnnouncement: topItem || null
    })
  } catch (err) {
    logger.error(`删除公告失败: ${err}`)
  }
}

watch(
  () => props.roomId,
  (newId) => {
    if (newId) loadAnnouncements()
  }
)

onMounted(() => {
  loadAnnouncements()
})
</script>
