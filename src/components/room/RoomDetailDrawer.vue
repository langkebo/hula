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
              <!-- Hero 区域（跨 Tab 常驻，用于确认当前房间身份） -->
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
                    <span class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] font-mono truncate">
                      {{ truncateMiddle(roomId ?? '', 20, 10, 6) }}
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

              <!-- Tab 导航 -->
              <nav class="room-drawer__tabs" role="tablist" :aria-label="t('room.detail.title')">
                <button
                  v-for="tab in drawerTabs"
                  :key="tab.key"
                  type="button"
                  role="tab"
                  class="room-drawer__tab"
                  :class="{ 'is-active': activeTab === tab.key }"
                  :aria-selected="activeTab === tab.key"
                  :data-testid="`room-drawer-tab-${tab.key}`"
                  @click="activeTab = tab.key">
                  {{ t(tab.label) }}
                </button>
              </nav>

              <div class="room-drawer__body">
                <!-- 概览：统计 / 最近消息 / 房间元数据 -->
                <div
                  v-if="activeTab === 'overview'"
                  class="room-drawer__panel"
                  role="tabpanel"
                  data-testid="room-drawer-panel-overview">
                  <section class="room-drawer__section">
                    <RoomDetailStats
                      :member-count="roomDetail.memberCount"
                      :online-count="roomDetail.onlineCount"
                      :announcement-count="announcementCount" />
                  </section>

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

                  <section class="room-drawer__section">
                    <RoomDetailLastMessage
                      :last-message="lastMessage"
                      :sender-name="lastMessageSender"
                      :timestamp="lastMessageTime" />
                  </section>

                  <section class="room-drawer__section">
                    <RoomMetadataPanel :room-id="roomId ?? ''" />
                  </section>
                </div>

                <!-- 成员 -->
                <div
                  v-if="activeTab === 'members'"
                  class="room-drawer__panel"
                  role="tabpanel"
                  data-testid="room-drawer-panel-members">
                  <RoomDetailMembers
                    :members="roomMembers"
                    :loading="membersLoading"
                    :error="membersError"
                    @retry="retryMembers" />
                </div>

                <!-- 安全：签名校验 / 加密事件 / 保留策略（保留策略与加密无关，常驻） -->
                <div
                  v-if="activeTab === 'security'"
                  class="room-drawer__panel"
                  role="tabpanel"
                  data-testid="room-drawer-panel-security">
                  <section v-if="showE2eePanels" class="room-drawer__section">
                    <EventSignaturePanel :room-id="roomId ?? ''" />
                  </section>
                  <section v-if="showE2eePanels" class="room-drawer__section">
                    <RoomEncryptedEventsPanel :room-id="roomId ?? ''" />
                  </section>
                  <section class="room-drawer__section">
                    <RoomRetentionPanel :room-id="roomId ?? ''" />
                  </section>
                </div>

                <!-- 高级：房间能力 / 消息队列 / 置顶公告 -->
                <div
                  v-if="activeTab === 'advanced'"
                  class="room-drawer__panel"
                  role="tabpanel"
                  data-testid="room-drawer-panel-advanced">
                  <section class="room-drawer__section">
                    <RoomCapabilitiesPanel :room-id="roomId ?? ''" />
                  </section>
                  <section class="room-drawer__section">
                    <RoomMessageQueuePanel :room-id="roomId ?? ''" />
                  </section>
                  <section class="room-drawer__section">
                    <RoomDetailPinnedMessages :messages="pinnedMessages" :loading="pinnedLoading" />
                  </section>
                </div>
              </div>

              <!-- 底部操作栏 -->
              <footer class="room-drawer__footer">
                <n-button type="primary" class="flex-1" data-testid="room-drawer-enter" @click="handleEnterRoom">
                  <template #icon>
                    <svg class="size-14px" aria-hidden="true"><use href="#message"></use></svg>
                  </template>
                  {{ t('room.detail.enter_chat') }}
                </n-button>
                <n-button secondary class="flex-1" data-testid="room-drawer-settings" @click="handleSettings">
                  <template #icon>
                    <svg class="size-14px" aria-hidden="true"><use href="#settings"></use></svg>
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
import EventSignaturePanel from '@/components/room/EventSignaturePanel.vue'
import RoomCapabilitiesPanel from '@/components/room/RoomCapabilitiesPanel.vue'
import RoomDetailLastMessage from '@/components/room/RoomDetailLastMessage.vue'
import RoomDetailMembers from '@/components/room/RoomDetailMembers.vue'
import RoomDetailPinnedMessages from '@/components/room/RoomDetailPinnedMessages.vue'
import RoomDetailStats from '@/components/room/RoomDetailStats.vue'
import RoomEncryptedEventsPanel from '@/components/room/RoomEncryptedEventsPanel.vue'
import RoomMessageQueuePanel from '@/components/room/RoomMessageQueuePanel.vue'
import RoomMetadataPanel from '@/components/room/RoomMetadataPanel.vue'
import RoomRetentionPanel from '@/components/room/RoomRetentionPanel.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'
import { OnlineEnum } from '@/enums'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'
import { truncateMiddle } from '@/utils/StringUtils'
import { unknownToObject } from '@/utils/typeGuard'

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
const { getCapabilityStatus } = useServerCapability()
const groupStore = useGroupStore()

type DrawerTab = 'overview' | 'members' | 'security' | 'advanced'

/**
 * Tab 结构（§13.4.1）。
 * - 概览 / 成员 / 高级：面板自带四态（加载 / 空 / 错误 / 有数据），始终存在
 * - 安全：`Retention` 与房间是否加密无关，故该 Tab 常驻；
 *   `EventSignature` / `EncryptedEvents` 依赖 E2EE 扩展端点，能力快照判定为
 *   `unsupported` 时整块隐藏（`unknown` 仍展示，避免能力未加载时误删入口）
 */
const drawerTabs: ReadonlyArray<{ key: DrawerTab; label: string }> = [
  { key: 'overview', label: 'room.detail.tab_overview' },
  { key: 'members', label: 'room.detail.tab_members' },
  { key: 'security', label: 'room.detail.tab_security' },
  { key: 'advanced', label: 'room.detail.tab_advanced' }
]

const activeTab = ref<DrawerTab>('overview')
const showE2eePanels = computed(() => getCapabilityStatus('e2ee') !== 'unsupported')

const loading = ref(false)
const roomDetail = ref<RoomDetail | null>(null)
const roomMembers = ref<MatrixRoomMember[]>([])
const membersLoading = ref(false)
/** 成员加载失败原因：仅在成员 Tab 内展示局部失败横幅，不影响概览等其它面板 */
const membersError = computed(() => (props.roomId ? groupStore.getMembersLoadError(props.roomId) : ''))
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
    const timeline = unknownToObject<{
      getLiveTimeline?: () => { getEvents?: () => MatrixTimelineEvent[] }
    }>(room)?.getLiveTimeline?.()
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
      // loadRoomMembers 命中缓存直接返回；未命中时才请求，失败原因由 store 记录，UI 走局部失败横幅
      const members = await groupStore.loadRoomMembers(props.roomId)
      memberCount = Math.max(memberCount, members?.length || 0)
      onlineCount = members?.filter((m) => m.activeStatus === OnlineEnum.ONLINE).length || 0
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

/** 成员局部失败后的重试：强制刷新成员，成功后 store 会清空错误信号 */
const retryMembers = async () => {
  if (!props.roomId) return
  membersLoading.value = true
  try {
    roomMembers.value = await groupStore.loadRoomMembers(props.roomId, true)
  } finally {
    membersLoading.value = false
  }
}

watch(
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      activeTab.value = 'overview'
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
  padding: 16px 20px 20px;
}

.room-drawer__panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-drawer__tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.room-drawer__tab {
  position: relative;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-sm);
  cursor: pointer;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-primary);
  }

  &.is-active {
    color: var(--tjg-text-primary);
    font-weight: var(--tjg-font-weight-medium);

    &::after {
      content: '';
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: -1px;
      height: 2px;
      border-radius: 1px;
      background: var(--tjg-color-primary-500);
    }
  }
}

.room-drawer__hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 12px;
  flex-shrink: 0;
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
  transition: transform var(--tjg-motion-duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
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
