<template>
  <aside
    class="workbench-detail-pane border-l border-[--hula-border-default]"
    :class="{
      'workbench-detail-pane--compact': compact,
      'workbench-detail-pane--narrow': narrow,
      'workbench-detail-pane--drawer': drawerMode,
      'workbench-detail-pane--drawer-open': drawerMode && drawerVisible
    }">
    <div class="workbench-detail-pane__header">
      <n-flex :size="4" align="center" class="flex-1 min-w-0">
        <span class="text-13px font-600 truncate">{{ paneTitle }}</span>
      </n-flex>
      <template v-if="drawerMode && !overlayMode && !computedManageMode">
        <WorkbenchPaneTabs v-model="activeTab" :tabs="visibleTabs" />
        <button
          type="button"
          class="detail-members__toggle"
          data-test="detail-close-drawer"
          @click="emit('closeDrawer')">
          {{ t('common.close') }}
        </button>
      </template>
      <template v-else-if="overlayMode">
        <button type="button" class="detail-members__toggle" @click="emit('closeOverlay')">
          {{ t('common.close') }}
        </button>
      </template>
      <template v-else-if="computedManageMode">
        <button type="button" class="detail-members__toggle" @click="emit('closeManagePane')">
          {{ t('common.close') }}
        </button>
      </template>
      <template v-else>
        <WorkbenchPaneTabs v-model="activeTab" :tabs="visibleTabs" />
      </template>
    </div>

    <div class="workbench-detail-pane__body">
      <WorkbenchQuickCreate
        v-if="overlayMode === 'create-room'"
        @close="emit('closeOverlay')"
        @created="handleQuickCreateCreated" />

      <WorkbenchQuickCreate
        v-else-if="overlayMode === 'create-space'"
        :is-space-mode="true"
        @close="emit('closeOverlay')"
        @created="handleQuickCreateCreated" />

      <WorkbenchForwardPane
        v-else-if="overlayMode === 'forward'"
        :event-id="forwardEventId"
        :room-id="forwardRoomId"
        @close="emit('closeOverlay')"
        @forwarded="handleForwarded" />

      <WorkbenchSearchPane
        v-else-if="overlayMode === 'search'"
        @close="emit('closeOverlay')"
        @message-selected="handleSearchMessageSelected"
        @room-selected="handleSearchRoomSelected"
        @user-selected="handleSearchUserSelected" />

      <WorkbenchHistoryPane
        v-else-if="overlayMode === 'history'"
        :room-id="historyRoomId"
        @close="emit('closeOverlay')" />

      <WorkbenchMergedMsgPane
        v-else-if="overlayMode === 'merged-msg'"
        :msg-ids="mergedMsgIds"
        @close="emit('closeOverlay')" />

      <template v-else>
        <div v-if="showManageMode" class="detail-mode-view" data-test="detail-mode-manage">
          <section v-if="activeSpace" class="detail-card detail-card--manage" data-test="detail-manage-card">
            <div class="detail-card__title">{{ manageCardTitle }}</div>
            <p class="detail-card__hint">{{ activeSpace.name }}</p>

            <n-form label-placement="top" :show-feedback="false" class="detail-manage-form">
              <n-form-item v-if="computedManageMode === 'invite'" :label="t('space.invite')">
                <n-input
                  :value="computedInviteUserId"
                  :placeholder="t('space.invite_user_placeholder')"
                  @update:value="emit('update:inviteUserId', $event)" />
              </n-form-item>

              <template v-else-if="computedManageMode === 'add-room'">
                <n-form-item :label="t('space.add_room')">
                  <n-input
                    :value="computedAddRoomId"
                    :placeholder="t('space.add_room_placeholder')"
                    @update:value="emit('update:addRoomId', $event)" />
                </n-form-item>
                <n-checkbox
                  :checked="computedAddRoomSuggested"
                  @update:checked="emit('update:addRoomSuggested', $event)">
                  {{ t('space.add_room_suggested') }}
                </n-checkbox>
              </template>

              <template v-else-if="computedManageMode === 'settings'">
                <n-form-item :label="t('space.name')">
                  <n-input
                    :value="computedSettingsName"
                    :placeholder="t('space.name_placeholder')"
                    @update:value="emit('update:settingsName', $event)" />
                </n-form-item>
                <n-form-item :label="t('space.topic')">
                  <n-input
                    :value="computedSettingsTopic"
                    type="textarea"
                    :rows="3"
                    :placeholder="t('space.topic_placeholder')"
                    @update:value="emit('update:settingsTopic', $event)" />
                </n-form-item>
              </template>
            </n-form>

            <n-flex justify="flex-end" :size="12" class="detail-manage-actions">
              <n-button @click="emit('closeManagePane')">{{ t('common.cancel') }}</n-button>
              <n-button
                type="primary"
                :loading="computedManageSubmitting"
                :disabled="!computedCanManageSpace"
                @click="emit('submitManagePane')">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </section>
        </div>

        <div v-else-if="showSummaryMode" class="detail-mode-view" data-test="detail-mode-summary">
          <section v-if="selectedSession" class="detail-card" data-test="detail-session-card">
            <div class="detail-card__title">{{ t('space.detail_session') }}</div>
            <div class="detail-session">
              <img
                class="detail-session__avatar"
                :src="AvatarUtils.getAvatarUrl(selectedSession.avatar)"
                :alt="selectedSession.name || t('space.detail_session')" />
              <div class="min-w-0 flex-1">
                <div class="detail-session__name">{{ selectedSession.name }}</div>
                <div class="detail-session__type">
                  {{
                    selectedSession.type === RoomTypeEnum.GROUP
                      ? t('space.detail_type_group')
                      : t('space.detail_type_single')
                  }}
                </div>
              </div>
            </div>

            <dl class="detail-meta">
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_last_active') }}</dt>
                <dd>{{ selectedSession.lastMsgTime || '-' }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_unread') }}</dt>
                <dd>{{ selectedSession.unreadCount ?? 0 }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_last_message') }}</dt>
                <dd class="detail-meta__message">{{ selectedSession.lastMsg || '-' }}</dd>
              </div>
            </dl>
          </section>

          <section v-else class="detail-card detail-card--empty" data-test="detail-session-empty">
            <div class="detail-card__title">{{ t('space.detail_session') }}</div>
            <div class="detail-empty__title">{{ t('space.details_empty_title') }}</div>
            <p class="detail-empty__description">{{ t('space.details_empty_description') }}</p>
          </section>

          <section class="detail-card" data-test="detail-space-card">
            <div class="detail-card__title">{{ t('space.detail_space') }}</div>
            <dl class="detail-meta">
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_scope') }}</dt>
                <dd>{{ activeSpace ? activeSpace.name : t('space.detail_scope_all') }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.topic') }}</dt>
                <dd class="detail-meta__text">
                  {{ activeSpace?.topic || t('space.detail_space_topic_empty') }}
                </dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.members') }}</dt>
                <dd>{{ activeSpace?.memberCount ?? '-' }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.rooms') }}</dt>
                <dd>{{ activeSpace?.childCount ?? '-' }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_visible_sessions') }}</dt>
                <dd>{{ visibleSessionCount }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_total_sessions') }}</dt>
                <dd>{{ totalSessionCount }}</dd>
              </div>
            </dl>

            <div v-if="activeSpace" class="detail-members">
              <div class="detail-members__title">{{ t('space.detail_space_rooms_preview') }}</div>

              <div v-if="spaceRoomsPreview.length" class="detail-members__grid">
                <div v-for="room in spaceRoomsPreview" :key="room.roomId" class="detail-member">
                  <img
                    class="detail-space-room__avatar"
                    :src="AvatarUtils.getAvatarUrl(room.avatarUrl || '')"
                    :alt="room.name || room.roomId" />
                  <span class="detail-member__name">
                    {{ room.name || room.roomId }}
                  </span>
                </div>
              </div>
              <div v-else-if="spaceRoomsLoadFailed" class="detail-announcement-state">
                <span class="detail-card__hint">{{ t('space.detail_space_rooms_load_failed') }}</span>
                <button type="button" class="detail-announcement__retry" @click="handleRetrySpaceRooms">
                  {{ t('common.retry') }}
                </button>
              </div>
              <p v-else-if="spaceRoomsReady" class="detail-card__hint">{{ t('space.detail_space_rooms_empty') }}</p>
            </div>
          </section>
        </div>

        <div v-else-if="showActivityMode" class="detail-mode-view" data-test="detail-mode-activity">
          <section v-if="showGroupInsights" class="detail-card" data-test="detail-group-card">
            <div class="detail-card__title">{{ t('space.detail_group') }}</div>

            <dl class="detail-meta">
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_members_count') }}</dt>
                <dd>{{ groupMemberCount }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_online_members') }}</dt>
                <dd>{{ groupOnlineCount }}</dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('space.detail_announcement') }}</dt>
                <dd>
                  <div v-if="announcementLoadFailed" class="detail-announcement-state">
                    <span class="detail-card__hint">{{ t('space.detail_announcement_load_failed') }}</span>
                    <button type="button" class="detail-announcement__retry" @click="handleRetryAnnouncement">
                      {{ t('common.retry') }}
                    </button>
                  </div>
                  <div v-else-if="announcementSegments.length" class="detail-announcement">
                    <template
                      v-for="(segment, index) in announcementSegments"
                      :key="`ann-seg-${selectedSession?.roomId ?? 'none'}-${index}`">
                      <button
                        v-if="segment.isLink"
                        type="button"
                        class="detail-announcement__link"
                        @click="openAnnouncementLink(segment.text)">
                        {{ segment.text }}
                      </button>
                      <span v-else>{{ segment.text }}</span>
                    </template>
                  </div>
                  <span v-else class="detail-card__hint">{{ t('space.detail_announcement_empty') }}</span>

                  <div v-if="groupRoomId" class="detail-announcement__actions">
                    <button type="button" class="detail-members__toggle" @click="handleOpenAnnouncement()">
                      {{ t('space.detail_view_all_announcements') }}
                    </button>
                    <button
                      v-if="canEditAnnouncement"
                      type="button"
                      class="detail-members__toggle"
                      @click="handleOpenAnnouncement()">
                      {{ t('space.detail_edit_announcement') }}
                    </button>
                  </div>
                </dd>
              </div>
            </dl>

            <div class="detail-members">
              <div class="detail-members__title">{{ t('space.detail_members_preview') }}</div>

              <div v-if="groupMembersPreview.length" class="detail-members__grid">
                <button
                  v-for="member in groupMembersPreview"
                  :key="member.userId"
                  type="button"
                  class="detail-member"
                  @click="handleMemberClick(member)">
                  <img
                    class="detail-member__avatar"
                    :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')"
                    :alt="member.displayName || member.name || member.userId" />
                  <span class="detail-member__name">
                    {{ member.displayName || member.name || member.userId }}
                  </span>
                </button>
              </div>
              <div v-if="groupMembersPreview.length" class="detail-members__actions">
                <button
                  v-if="hasExpandableMembers"
                  type="button"
                  class="detail-members__toggle detail-members__expand-toggle"
                  @click="showAllMembers = !showAllMembers">
                  {{ showAllMembers ? t('space.detail_members_collapse') : t('space.detail_members_expand') }}
                </button>
                <button
                  type="button"
                  class="detail-members__toggle detail-members__directory-toggle"
                  @click="openMembersMode(true)">
                  {{ t('space.detail_members_view_all') }}
                </button>
              </div>
              <div v-else-if="memberLoadFailed" class="detail-announcement-state">
                <span class="detail-card__hint">{{ t('space.detail_members_load_failed') }}</span>
                <button type="button" class="detail-announcement__retry" @click="handleRetryMembers">
                  {{ t('common.retry') }}
                </button>
              </div>
              <p v-else class="detail-card__hint">{{ t('space.detail_members_empty') }}</p>
            </div>
          </section>
        </div>

        <div v-else-if="showMembersMode" class="detail-mode-view" data-test="detail-mode-members">
          <section class="detail-card" data-test="detail-members-tab">
            <div class="detail-card__title detail-card__title--row">
              <span>{{ t('space.detail_tab_members') }}</span>
              <button
                v-if="detailMembers.length && !showMemberDirectory"
                type="button"
                class="detail-members__toggle detail-members__directory-toggle"
                @click="showMemberDirectory = true">
                {{ t('space.detail_members_view_all') }}
              </button>
            </div>

            <div v-if="detailMembers.length" class="detail-members">
              <div v-if="showMemberDirectory" class="detail-members__directory">
                <MemberList
                  :room-id="groupRoomId"
                  :members="
                    detailMembers.map((m) => ({
                      userId: m.userId,
                      displayName: m.displayName ?? undefined,
                      avatarUrl: m.avatarUrl ?? undefined,
                      powerLevel: m.powerLevel,
                      membership: m.membership
                    }))
                  "
                  @member-click="
                    (member) => {
                      const fullMember = detailMembers.find((m) => m.userId === member.userId)
                      if (fullMember) handleMemberClick(fullMember)
                    }
                  " />
              </div>
              <div v-else class="detail-members__grid">
                <button
                  v-for="member in groupMembersPreview"
                  :key="member.userId"
                  type="button"
                  class="detail-member"
                  @click="handleMemberClick(member)">
                  <img
                    class="detail-member__avatar"
                    :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')"
                    :alt="member.displayName || member.name || member.userId" />
                  <span class="detail-member__name">
                    {{ member.displayName || member.name || member.userId }}
                  </span>
                </button>
              </div>
              <div class="detail-members__actions">
                <button
                  v-if="hasExpandableMembers && !showMemberDirectory"
                  type="button"
                  class="detail-members__toggle detail-members__expand-toggle"
                  @click="showAllMembers = !showAllMembers">
                  {{ showAllMembers ? t('space.detail_members_collapse') : t('space.detail_members_expand') }}
                </button>
                <button
                  v-if="showMemberDirectory"
                  type="button"
                  class="detail-members__toggle detail-members__directory-toggle"
                  @click="showMemberDirectory = false">
                  {{ t('space.detail_members_hide_directory') }}
                </button>
              </div>
            </div>
            <div v-else-if="memberLoadFailed" class="detail-announcement-state">
              <span class="detail-card__hint">{{ t('space.detail_members_load_failed') }}</span>
              <button type="button" class="detail-announcement__retry" @click="handleRetryMembers">
                {{ t('common.retry') }}
              </button>
            </div>
            <p v-else class="detail-card__hint">{{ t('space.detail_members_empty') }}</p>
          </section>

          <section v-if="selectedMemberUid" class="detail-card" data-test="detail-member-profile-card">
            <div class="detail-card__title detail-card__title--row">
              <span>{{ t('space.detail_member_profile') }}</span>
              <button type="button" class="detail-members__toggle" @click="clearSelectedMember">
                {{ t('common.close') }}
              </button>
            </div>
            <div class="detail-member-profile">
              <InfoPopover :uid="selectedMemberUid" :activeStatus="selectedMemberActiveStatus" />
            </div>
          </section>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoPopover from '@/components/common/InfoPopover.vue'
import MemberList from '@/components/room/MemberList.vue'
import WorkbenchForwardPane from '@/components/workbench/WorkbenchForwardPane.vue'
import WorkbenchHistoryPane from '@/components/workbench/WorkbenchHistoryPane.vue'
import WorkbenchMergedMsgPane from '@/components/workbench/WorkbenchMergedMsgPane.vue'
import type { PaneTab } from '@/components/workbench/WorkbenchPaneTabs.vue'
import WorkbenchPaneTabs from '@/components/workbench/WorkbenchPaneTabs.vue'
import WorkbenchQuickCreate from '@/components/workbench/WorkbenchQuickCreate.vue'
import WorkbenchSearchPane from '@/components/workbench/WorkbenchSearchPane.vue'
import { type SpaceChildRoom, useSpaceRooms } from '@/composables/space/useSpaceRooms'
import { MittEnum, OnlineEnum, RoomTypeEnum } from '@/enums'
import { useLinkSegments } from '@/hooks/useLinkSegments'
import { useMitt } from '@/hooks/useMitt'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { type MatrixGroupInfo, type MatrixRoomMember, useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

type SpaceListItem = {
  spaceId: string
  name: string
  topic?: string
  memberCount?: number
  childCount: number
}

type SessionListItem = SessionItem & {
  lastMsg?: string
  lastMsgTime?: string
  isAtMe?: boolean
}

type SpaceManageMode = 'invite' | 'add-room' | 'settings'
type OverlayMode = 'create-room' | 'create-space' | 'forward' | 'search' | 'history' | 'merged-msg'

const props = defineProps<{
  selectedSession: SessionListItem | null
  activeSpace: SpaceListItem | null
  visibleSessionCount: number
  totalSessionCount: number
  compact?: boolean
  narrow?: boolean
  drawerMode?: boolean
  drawerVisible?: boolean
  manageMode?: SpaceManageMode | null
  canManageSpace?: boolean
  manageSubmitting?: boolean
  inviteUserId?: string
  addRoomId?: string
  addRoomSuggested?: boolean
  settingsName?: string
  settingsTopic?: string
  overlayMode?: OverlayMode | null
  forwardEventId?: string
  forwardRoomId?: string
  historyRoomId?: string
  mergedMsgIds?: string[]
}>()

const emit = defineEmits<{
  closeManagePane: []
  submitManagePane: []
  'update:inviteUserId': [value: string]
  'update:addRoomId': [value: string]
  'update:addRoomSuggested': [value: boolean]
  'update:settingsName': [value: string]
  'update:settingsTopic': [value: string]
  closeDrawer: []
  closeOverlay: []
  overlayCreated: [data: { roomId?: string; space?: unknown }]
  overlayForwarded: [roomIds: string[]]
  overlayMessageSelected: [roomId: string, eventId: string]
  overlayRoomSelected: [roomId: string]
  overlayUserSelected: [userId: string]
}>()

const { t } = useI18n()
const groupStore = useGroupStore()
const announcementStore = useAnnouncementStore()

type DetailBrowseMode = 'summary' | 'members' | 'activity'
type DetailPaneMode = DetailBrowseMode | 'manage'

const activeTab = ref<DetailBrowseMode>('summary')

const visibleTabs = computed(() => {
  const tabs: PaneTab<DetailBrowseMode>[] = [
    { key: 'summary', label: t('space.detail_tab_summary') },
    { key: 'members', label: t('space.detail_tab_members') }
  ]
  if (props.selectedSession?.type === RoomTypeEnum.GROUP) {
    tabs.push({ key: 'activity', label: t('space.detail_tab_activity') })
  }
  return tabs
})

const detailGroupInfo = ref<MatrixGroupInfo | null>(null)
const detailMembers = ref<MatrixRoomMember[]>([])
const announcementPreview = ref('')
const showAllMembers = ref(false)
const showMemberDirectory = ref(false)
const selectedMemberUid = ref('')
const selectedMemberActiveStatus = ref<MatrixRoomMember['activeStatus'] | undefined>(undefined)
const memberLoadFailed = ref(false)
const announcementLoadFailed = ref(false)
const spaceRoomsReady = ref(false)
const { segments: announcementSegments, openLink: openAnnouncementLink } = useLinkSegments(announcementPreview)

const showGroupInsights = computed(() => props.selectedSession?.type === RoomTypeEnum.GROUP)
const groupRoomId = computed(() => (showGroupInsights.value ? (props.selectedSession?.roomId ?? '') : ''))
const activeSpaceId = computed(() => props.activeSpace?.spaceId ?? '')
const {
  rooms: detailSpaceRooms,
  error: detailSpaceRoomsError,
  load: loadDetailSpaceRooms
} = useSpaceRooms(() => activeSpaceId.value)
const spaceRoomsPreview = computed<SpaceChildRoom[]>(() => detailSpaceRooms.value.slice(0, 4))
const spaceRoomsLoadFailed = computed(
  () => spaceRoomsReady.value && Boolean(detailSpaceRoomsError.value) && !spaceRoomsPreview.value.length
)
const hasExpandableMembers = computed(() => detailMembers.value.length > 6)
const groupMembersPreview = computed(() =>
  showAllMembers.value ? detailMembers.value : detailMembers.value.slice(0, 6)
)
const groupMemberCount = computed(
  () => detailGroupInfo.value?.memberCount ?? detailGroupInfo.value?.memberNum ?? detailMembers.value.length
)
const groupOnlineCount = computed(() => {
  const hasPresence = detailMembers.value.some((member) => typeof member.activeStatus === 'number')
  if (!hasPresence) {
    return detailMembers.value.length
  }
  return detailMembers.value.filter((member) => member.activeStatus === OnlineEnum.ONLINE).length
})
const canEditAnnouncement = computed(() => showGroupInsights.value && Boolean(announcementStore.isAddAnnoun))
const computedManageMode = computed(() => props.manageMode ?? null)
const computedCanManageSpace = computed(() => Boolean(props.canManageSpace))
const computedManageSubmitting = computed(() => Boolean(props.manageSubmitting))
const computedInviteUserId = computed(() => props.inviteUserId ?? '')
const computedAddRoomId = computed(() => props.addRoomId ?? '')
const computedAddRoomSuggested = computed(() => Boolean(props.addRoomSuggested))
const computedSettingsName = computed(() => props.settingsName ?? '')
const computedSettingsTopic = computed(() => props.settingsTopic ?? '')
const currentPaneMode = computed<DetailPaneMode>(() => {
  if (computedManageMode.value) {
    return 'manage'
  }
  return activeTab.value
})
const showSummaryMode = computed(() => currentPaneMode.value === 'summary')
const showMembersMode = computed(() => currentPaneMode.value === 'members')
const showActivityMode = computed(() => currentPaneMode.value === 'activity')
const showManageMode = computed(() => currentPaneMode.value === 'manage')
const manageCardTitle = computed(() => {
  switch (computedManageMode.value) {
    case 'invite':
      return t('space.invite_title')
    case 'add-room':
      return t('space.add_room_title')
    case 'settings':
      return t('space.settings_title')
    default:
      return t('space.details_title')
  }
})
const managePaneTitle = computed(() => (computedManageMode.value ? manageCardTitle.value : t('space.details_title')))

const paneTitle = computed(() => {
  if (props.overlayMode) {
    switch (props.overlayMode) {
      case 'create-room':
        return t('room.create.title')
      case 'create-space':
        return t('space.create')
      case 'forward':
        return t('message.forward.title')
      case 'search':
        return t('search.title')
      case 'history':
        return t('chatHistory.title')
      case 'merged-msg':
        return t('message.merge_msg_title')
      default:
        return t('space.details_title')
    }
  }
  return managePaneTitle.value
})

const handleQuickCreateCreated = (data: { roomId?: string; space?: unknown }) => {
  emit('overlayCreated', data)
}

const handleForwarded = (roomIds: string[]) => {
  emit('overlayForwarded', roomIds)
}

const handleSearchMessageSelected = (roomId: string, eventId: string) => {
  emit('overlayMessageSelected', roomId, eventId)
}

const handleSearchRoomSelected = (roomId: string) => {
  emit('overlayRoomSelected', roomId)
}

const handleSearchUserSelected = (userId: string) => {
  emit('overlayUserSelected', userId)
}

const handleRetrySpaceRooms = async () => {
  const spaceId = activeSpaceId.value
  if (!spaceId) {
    return
  }

  spaceRoomsReady.value = false
  await loadDetailSpaceRooms()
  if (activeSpaceId.value === spaceId) {
    spaceRoomsReady.value = true
  }
}

const handleOpenAnnouncement = () => {
  const roomId = groupRoomId.value
  if (!roomId) {
    return
  }

  useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId })
}

const handleMemberClick = (member: MatrixRoomMember) => {
  const uid = member.uid || member.userId
  if (!uid) {
    return
  }

  selectedMemberUid.value = uid
  selectedMemberActiveStatus.value = member.activeStatus
  activeTab.value = 'members'
}

const openMembersMode = (showDirectory: boolean = false) => {
  activeTab.value = 'members'
  showMemberDirectory.value = showDirectory
}

const clearSelectedMember = () => {
  selectedMemberUid.value = ''
  selectedMemberActiveStatus.value = undefined
}

const handleRetryAnnouncement = async () => {
  const roomId = groupRoomId.value
  if (!roomId) {
    return
  }

  try {
    await announcementStore.loadGroupAnnouncements(roomId)
    if (groupRoomId.value !== roomId) {
      return
    }

    announcementLoadFailed.value = Boolean(announcementStore.announError)
    announcementPreview.value =
      announcementStore.announcementContent ||
      announcementStore.announList[0]?.content ||
      detailGroupInfo.value?.topic ||
      ''
  } catch {
    if (groupRoomId.value === roomId) {
      announcementLoadFailed.value = true
    }
  }
}

const handleRetryMembers = async () => {
  const roomId = groupRoomId.value
  if (!roomId) {
    return
  }

  try {
    const members = await groupStore.loadRoomMembers(roomId, true)
    if (groupRoomId.value !== roomId) {
      return
    }

    detailMembers.value = members.length ? members : groupStore.getMembersByRoomId(roomId)
    memberLoadFailed.value = detailMembers.value.length === 0
  } catch {
    if (groupRoomId.value === roomId) {
      memberLoadFailed.value = true
    }
  }
}

watch(
  () => props.selectedSession?.roomId,
  () => {
    activeTab.value = 'summary'
    showAllMembers.value = false
    showMemberDirectory.value = false
    clearSelectedMember()
  }
)

watch(
  activeSpaceId,
  async (spaceId) => {
    spaceRoomsReady.value = false

    if (!spaceId) {
      return
    }

    await loadDetailSpaceRooms()
    if (activeSpaceId.value === spaceId) {
      spaceRoomsReady.value = true
    }
  },
  { immediate: true }
)

watch(
  groupRoomId,
  async (roomId) => {
    detailGroupInfo.value = null
    detailMembers.value = []
    announcementPreview.value = ''
    showAllMembers.value = false
    showMemberDirectory.value = false
    clearSelectedMember()
    memberLoadFailed.value = false
    announcementLoadFailed.value = false

    if (!roomId) {
      return
    }

    const [groupInfoResult, membersResult, announcementResult] = await Promise.allSettled([
      groupStore.loadGroupInfo(roomId),
      groupStore.loadRoomMembers(roomId),
      announcementStore.loadGroupAnnouncements(roomId)
    ])

    if (groupRoomId.value !== roomId) {
      return
    }

    const cachedGroupInfo = groupStore.getGroupDetailByRoomId(roomId)
    const cachedMembers = groupStore.getMembersByRoomId(roomId)
    detailGroupInfo.value =
      groupInfoResult.status === 'fulfilled'
        ? (groupInfoResult.value ?? cachedGroupInfo ?? null)
        : (cachedGroupInfo ?? null)
    detailMembers.value =
      membersResult.status === 'fulfilled'
        ? membersResult.value.length
          ? membersResult.value
          : cachedMembers
        : cachedMembers
    memberLoadFailed.value = membersResult.status === 'rejected' && detailMembers.value.length === 0

    if (announcementResult.status === 'fulfilled') {
      announcementLoadFailed.value = Boolean(announcementStore.announError)
      announcementPreview.value =
        announcementStore.announcementContent ||
        announcementStore.announList[0]?.content ||
        detailGroupInfo.value?.topic ||
        ''
      return
    }

    announcementLoadFailed.value = true
    announcementPreview.value = detailGroupInfo.value?.topic || ''
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.workbench-detail-pane {
  display: flex;
  width: 320px;
  min-width: 320px;
  flex-direction: column;
  background: var(--hula-surface-panel);
}

.workbench-detail-pane--compact {
  width: 280px;
  min-width: 280px;
}

.workbench-detail-pane--narrow {
  width: 240px;
  min-width: 240px;
}

.workbench-detail-pane--drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: min(360px, calc(100% - 48px));
  min-width: min(360px, calc(100% - 48px));
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
  box-shadow: -12px 0 32px color-mix(in srgb, var(--hula-text-primary) 16%, transparent);
  transition:
    transform 0.24s ease,
    opacity 0.24s ease;
}

.workbench-detail-pane--drawer-open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.workbench-detail-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-default);
}

.workbench-detail-pane__body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: auto;
  background: var(--hula-surface-panel-muted);
}

.workbench-detail-pane--compact .workbench-detail-pane__header {
  padding: 10px 12px;
}

.workbench-detail-pane--compact .workbench-detail-pane__body {
  gap: 10px;
  padding: 12px;
}

.workbench-detail-pane--compact .detail-card {
  padding: 12px;
}

.workbench-detail-pane--narrow .detail-meta__row {
  grid-template-columns: 1fr;
  gap: 4px;
}

.workbench-detail-pane--narrow .detail-session {
  align-items: flex-start;
}

.detail-card {
  padding: 16px;
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-lg);
  background: var(--hula-surface-panel);
}

.detail-card__title {
  margin-bottom: 12px;
  color: var(--hula-text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.detail-card__title--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-card__hint {
  color: var(--hula-text-tertiary);
  font-size: 12px;
  line-height: 1.6;
}

.detail-card--empty {
  display: flex;
  min-height: 168px;
  flex-direction: column;
  justify-content: center;
}

.detail-card--manage {
  gap: 12px;
}

.detail-manage-form {
  margin-top: 12px;
}

.detail-manage-actions {
  margin-top: 16px;
}

.detail-session {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-session__avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-md);
  object-fit: cover;
  background: var(--hula-surface-subtle);
}

.detail-session__name {
  overflow: hidden;
  color: var(--hula-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 600;
}

.detail-session__type {
  margin-top: 4px;
  color: var(--hula-text-tertiary);
  font-size: 12px;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-meta__row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  color: var(--hula-text-secondary);
  font-size: 13px;
}

.detail-meta__row dt {
  color: var(--hula-text-tertiary);
}

.detail-meta__row dd {
  margin: 0;
  color: var(--hula-text-primary);
}

.detail-meta__message {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  word-break: break-word;
}

.detail-meta__text {
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-empty__title {
  color: var(--hula-text-primary);
  font-size: 15px;
  font-weight: 600;
}

.detail-empty__description {
  margin: 8px 0 0;
  color: var(--hula-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.detail-announcement {
  display: -webkit-box;
  overflow: hidden;
  color: var(--hula-text-primary);
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  word-break: break-word;
}

.detail-announcement-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.detail-announcement__link,
.detail-announcement__retry,
.detail-members__toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--hula-color-primary-500);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
}

.detail-announcement__link:hover,
.detail-announcement__retry:hover,
.detail-members__toggle:hover {
  color: var(--hula-color-primary-600, var(--hula-color-primary-500));
  opacity: 0.88;
}

.detail-announcement__link:active,
.detail-announcement__retry:active,
.detail-members__toggle:active {
  opacity: 0.72;
}

.detail-announcement__link:focus-visible,
.detail-announcement__retry:focus-visible,
.detail-members__toggle:focus-visible {
  border-radius: var(--hula-radius-xs);
}

.detail-announcement__actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.detail-members {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--hula-border-default);
}

.detail-members__title {
  margin-bottom: 12px;
  color: var(--hula-text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.detail-members__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.detail-members__actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.detail-members__directory {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-lg);
  background: var(--hula-surface-subtle);
}

.detail-members__directory :deep(.member-header) {
  display: none;
}

.detail-members__directory :deep(.member-filter) {
  margin-bottom: 4px;
}

.detail-members__directory :deep(.member-group) {
  gap: 8px;
}

.detail-members__directory :deep(.group-label) {
  padding: 0;
  color: var(--hula-text-secondary);
  font-size: 12px;
}

.detail-members__directory :deep(.member-item) {
  padding: 8px 10px;
  border-radius: var(--hula-radius-md);
}

.detail-members__directory :deep(.member-item:hover) {
  background: var(--hula-fill-hover);
}

.detail-member-profile {
  overflow: hidden;
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-lg);
  background: var(--hula-surface-subtle);
}

.detail-member-profile :deep(.n-flex) {
  width: 100%;
}

.detail-members__directory :deep(.member-role) {
  color: var(--hula-color-primary-500);
}

.detail-members__directory :deep(.member-count),
.detail-members__directory :deep(.group-label),
.detail-members__directory :deep(.n-input__placeholder) {
  color: var(--hula-text-secondary);
}

.detail-members__directory :deep(.member-status.join .status-dot) {
  background: var(--hula-color-success-500);
}

.detail-members__directory :deep(.member-status.invite .status-dot) {
  background: var(--hula-color-warning-500);
}

.detail-members__directory :deep(.member-status.leave .status-dot),
.detail-members__directory :deep(.member-status.ban .status-dot) {
  background: var(--hula-text-tertiary);
}

.detail-member {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--hula-radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.detail-member:hover {
  background: var(--hula-fill-hover);
}

.detail-member:active {
  transform: translateY(1px);
}

.detail-member:focus-visible {
  outline-offset: 1px;
}

.detail-member__avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 999px;
  object-fit: cover;
  background: var(--hula-surface-subtle);
}

.detail-space-room__avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--hula-radius-md);
  object-fit: cover;
  background: var(--hula-surface-subtle);
}

.detail-member__name {
  overflow: hidden;
  color: var(--hula-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
</style>
