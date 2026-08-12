<template>
  <Teleport to="body">
    <Transition name="room-drawer-fade">
      <div v-if="roomId" class="room-drawer-overlay" data-testid="room-drawer-overlay" @click.self="handleClose">
        <Transition name="room-drawer-slide" appear>
          <aside
            v-if="roomId"
            class="room-drawer"
            role="dialog"
            aria-modal="true"
            :aria-label="roomDetail ? t('room.detail.title') : t('room.detail.loading')"
            data-testid="room-drawer">
            <!-- 头部 -->
            <header class="room-drawer__header">
              <span class="room-drawer__title">
                {{ roomDetail ? t('room.detail.title') : t('room.detail.loading') }}
              </span>
              <button type="button" class="room-drawer__close" :aria-label="t('common.close')" @click="handleClose">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>

            <!-- 加载中 -->
            <div v-if="loading" class="room-drawer__loading flex-center">
              <n-spin size="medium" />
            </div>

            <!-- 内容 -->
            <template v-else-if="roomDetail">
              <div class="room-drawer__body">
                <!-- Hero 区域 -->
                <section class="room-drawer__hero">
                  <div
                    class="room-drawer__avatar shrink-0 flex items-center justify-center size-[64px] overflow-hidden rounded-[--tjg-radius-lg] bg-[--tjg-surface-subtle]">
                    <img v-if="roomDetail.avatar" :src="roomDetail.avatar" alt="" class="w-full h-full object-cover" />
                    <span
                      v-else
                      class="text-[length:var(--tjg-font-size-xl)] font-[--tjg-font-weight-medium] color-[--tjg-text-secondary]">
                      {{ avatarPlaceholder }}
                    </span>
                  </div>
                  <div class="room-drawer__hero-info flex-1 min-w-0">
                    <div class="flex items-center gap-[--tjg-space-2]">
                      <h3 class="room-drawer__name truncate text-[--tjg-text-primary]">{{ roomDetail.name }}</h3>
                      <span
                        v-if="roomDetail.isEncrypted"
                        class="inline-flex items-center shrink-0 color-[--tjg-color-success-500]"
                        :title="t('room.detail.encrypted')">
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                    </div>
                    <div class="room-drawer__id-row flex items-center gap-[--tjg-space-1] mt-2px">
                      <span
                        class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] font-mono truncate">
                        {{ truncateId(roomId) }}
                      </span>
                      <button
                        type="button"
                        class="room-drawer__copy-btn shrink-0 flex-center size-[20px] rounded-[--tjg-radius-xs] hover:bg-[--tjg-surface-list-hover] color-[--tjg-text-tertiary] cursor-pointer border-none"
                        :aria-label="t('common.copy')"
                        @click="copyRoomId">
                        <svg
                          viewBox="0 0 24 24"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </section>

                <!-- 统计卡片 -->
                <section class="room-drawer__section">
                  <RoomDetailStats
                    :member-count="roomDetail.memberCount"
                    :online-count="roomDetail.onlineCount"
                    :announcement-count="announcementCount" />
                </section>

                <!-- 房间描述 -->
                <section v-if="roomDetail.topic" class="room-drawer__section">
                  <div
                    class="room-drawer__section-title text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-medium] color-[--tjg-text-secondary] mb-[--tjg-space-1]">
                    {{ t('room.create.topic') }}
                  </div>
                  <p
                    class="room-drawer__description text-[length:var(--tjg-font-size-sm)] leading-[1.5] color-[--tjg-text-tertiary]">
                    {{ roomDetail.topic }}
                  </p>
                </section>

                <!-- 置顶公告 -->
                <section class="room-drawer__section">
                  <RoomDetailPinnedMessages :messages="pinnedMessages" :loading="pinnedLoading" />
                </section>

                <!-- 最近消息 -->
                <section class="room-drawer__section">
                  <RoomDetailLastMessage
                    :last-message="lastMessage"
                    :sender-name="lastMessageSender"
                    :timestamp="lastMessageTime" />
                </section>

                <!-- 核心成员 -->
                <section class="room-drawer__section">
                  <RoomDetailMembers :members="roomMembers" :loading="membersLoading" />
                </section>
              </div>

              <!-- 底部操作栏 -->
              <footer class="room-drawer__footer">
                <n-button type="primary" class="flex-1" data-testid="room-drawer-enter" @click="handleEnterRoom">
                  <template #icon>
                    <svg class="size-14px"><use href="#message"></use></svg>
                  </template>
                  {{ t('room.detail.enter_chat') }}
                </n-button>
                <n-button secondary class="flex-1" data-testid="room-drawer-settings" @click="handleSettings">
                  <template #icon>
                    <svg class="size-14px"><use href="#settings"></use></svg>
                  </template>
                  {{ t('room.detail.settings') }}
                </n-button>
              </footer>
            </template>

            <!-- 加载失败 -->
            <div v-else class="room-drawer__error flex-center flex-col gap-[--tjg-space-2] py-[--tjg-space-8]">
              <p class="text-[--tjg-text-tertiary]">{{ t('room.detail.load_failed') }}</p>
              <n-button size="small" @click="loadRoomDetail">{{ t('common.retry') }}</n-button>
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RoomDetailLastMessage from '@/components/room/RoomDetailLastMessage.vue'
import RoomDetailMembers from '@/components/room/RoomDetailMembers.vue'
import RoomDetailPinnedMessages from '@/components/room/RoomDetailPinnedMessages.vue'
import RoomDetailStats from '@/components/room/RoomDetailStats.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'
import { OnlineEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'

interface RoomDetail {
  name: string
  avatar: string
  topic: string
  memberCount: number
  onlineCount: number
  isEncrypted: boolean
}

const props = defineProps<{
  roomId: string | null
}>()

const emit = defineEmits<{
  close: []
  enterRoom: [roomId: string]
  settings: [roomId: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const loading = ref(false)
const roomDetail = ref<RoomDetail | null>(null)
const roomMembers = ref<MatrixRoomMember[]>([])
const membersLoading = ref(false)
const lastMessage = ref<string | null>(null)
const lastMessageSender = ref<string | null>(null)
const lastMessageTime = ref<number | null>(null)

const {
  pinnedEventIds,
  pinnedMessages,
  loading: pinnedLoading,
  load: loadPinnedMessages
} = usePinnedMessage({
  roomId: () => props.roomId
})

const announcementCount = computed(() => pinnedEventIds.value?.length ?? 0)

const avatarPlaceholder = computed(() => roomDetail.value?.name?.charAt(0) || '?')

const truncateId = (id: string) => {
  if (id.length <= 20) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

const copyRoomId = async () => {
  if (!props.roomId) return
  const { copy } = useClipboard()
  await copy(props.roomId)
  showFeedback(t('room.detail.id_copied'), 'success')
}

const handleClose = () => {
  emit('close')
}

const handleEnterRoom = () => {
  if (props.roomId) {
    emit('enterRoom', props.roomId)
  }
}

const handleSettings = () => {
  if (props.roomId) {
    emit('settings', props.roomId)
  }
}

interface MatrixTimelineEvent {
  getType?: () => string
  type?: string
  getContent?: () => Record<string, unknown> | undefined
  content?: Record<string, unknown>
  getSender?: () => string | null
  sender?: string
  getTs?: () => number | null
  origin_server_ts?: number
}

const resolveSenderName = (senderId: string | null): string | null => {
  if (!senderId) return null
  const member = roomMembers.value.find((m) => m.userId === senderId)
  return member?.displayName || member?.name || senderId
}

const resolveLastMessage = () => {
  if (!props.roomId) {
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
    return
  }
  try {
    const room = matrixClientService.getRoom(props.roomId)
    if (!room) return
    const timeline = (
      room as unknown as {
        getLiveTimeline?: () => { getEvents?: () => MatrixTimelineEvent[] }
      }
    ).getLiveTimeline?.()
    const events = timeline?.getEvents?.() ?? []
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
      const eventType = event.getType?.() ?? event.type
      if (eventType !== 'm.room.message' && eventType !== 'm.room.encrypted') continue
      const content = event.getContent?.() ?? event.content
      const body = (content?.body as string) ?? null
      const sender = event.getSender?.() ?? event.sender ?? null
      const ts = event.getTs?.() ?? event.origin_server_ts ?? null
      lastMessage.value = body
      lastMessageSender.value = resolveSenderName(sender)
      lastMessageTime.value = ts ?? null
      return
    }
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
  } catch {
    lastMessage.value = null
    lastMessageSender.value = null
    lastMessageTime.value = null
  }
}

const buildRoomDetail = async (): Promise<RoomDetail | null> => {
  if (!props.roomId) return null

  try {
    const groupInfo = await groupStore.getGroupDetailByRoomId(props.roomId)

    let onlineCount = 0
    let memberCount = groupInfo?.memberCount || 0

    try {
      const members = await groupStore.getMembersByRoomId(props.roomId)
      memberCount = Math.max(memberCount, members?.length || 0)
      onlineCount =
        members?.filter((m) => (m as unknown as Record<string, unknown>).activeStatus === OnlineEnum.ONLINE).length || 0
      roomMembers.value = (members as MatrixRoomMember[]) || []
    } catch {
      // member retrieval is best-effort
    }

    return {
      name: groupInfo?.name || props.roomId,
      avatar: groupInfo?.avatar || '',
      topic: groupInfo?.topic || '',
      memberCount,
      onlineCount,
      isEncrypted: groupInfo?.isEncrypted ?? false
    }
  } catch {
    return null
  }
}

const loadRoomDetail = async () => {
  if (!props.roomId) {
    roomDetail.value = null
    return
  }
  loading.value = true
  membersLoading.value = true
  roomDetail.value = await buildRoomDetail()
  loading.value = false
  membersLoading.value = false
  resolveLastMessage()
  try {
    await loadPinnedMessages?.()
  } catch {
    // best-effort
  }
}

watch(
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      void loadRoomDetail()
    } else {
      roomDetail.value = null
      roomMembers.value = []
      lastMessage.value = null
      lastMessageSender.value = null
      lastMessageTime.value = null
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.room-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--tjg-overlay-mask-default);
  display: flex;
  justify-content: flex-end;
}

.room-drawer {
  width: 480px;
  max-width: 90vw;
  height: 100%;
  background: var(--tjg-surface-panel);
  border-left: 1px solid var(--tjg-border-default);
  box-shadow: var(--tjg-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.room-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.room-drawer__title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.room-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }
}

.room-drawer__loading {
  flex: 1;
  min-height: 200px;
}

.room-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-drawer__hero {
  display: flex;
  align-items: center;
  gap: 12px;
}

.room-drawer__hero-info {
  min-width: 0;
}

.room-drawer__name {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin: 0;
}

.room-drawer__section {
  display: flex;
  flex-direction: column;
}

.room-drawer__description {
  margin: 0;
  word-break: break-word;
}

.room-drawer__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.room-drawer__error {
  flex: 1;
}

/* 淡入遮罩 */
.room-drawer-fade-enter-active,
.room-drawer-fade-leave-active {
  transition: opacity var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.room-drawer-fade-enter-from,
.room-drawer-fade-leave-to {
  opacity: 0;
}

/* 滑入抽屉 */
.room-drawer-slide-enter-active,
.room-drawer-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.room-drawer-slide-enter-from,
.room-drawer-slide-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .room-drawer-fade-enter-active,
  .room-drawer-fade-leave-active,
  .room-drawer-slide-enter-active,
  .room-drawer-slide-leave-active {
    transition: none;
  }
}
</style>
