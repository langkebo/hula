<template>
  <div class="detail-mode-view" data-test="detail-mode-activity">
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
              <button type="button" class="detail-announcement__retry" @click="emit('retryAnnouncement')">
                {{ t('common.retry') }}
              </button>
            </div>
            <div v-else-if="announcementSegments.length" class="detail-announcement">
              <template
                v-for="(segment, index) in announcementSegments"
                :key="`ann-seg-${selectedSessionRoomId ?? 'none'}-${index}`">
                <button
                  v-if="segment.isLink"
                  type="button"
                  class="detail-announcement__link"
                  @click="emit('openAnnouncementLink', segment.text)">
                  {{ segment.text }}
                </button>
                <span v-else>{{ segment.text }}</span>
              </template>
            </div>
            <span v-else class="detail-card__hint">{{ t('space.detail_announcement_empty') }}</span>

            <div v-if="groupRoomId" class="detail-announcement__actions">
              <button type="button" class="detail-members__toggle" @click="emit('openAnnouncement')">
                {{ t('space.detail_view_all_announcements') }}
              </button>
              <button
                v-if="canEditAnnouncement"
                type="button"
                class="detail-members__toggle"
                @click="emit('openAnnouncement')">
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
            @click="emit('memberClick', member)">
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
            @click="emit('toggleShowAllMembers')">
            {{ showAllMembers ? t('space.detail_members_collapse') : t('space.detail_members_expand') }}
          </button>
          <button
            type="button"
            class="detail-members__toggle detail-members__directory-toggle"
            @click="emit('openMembersMode', true)">
            {{ t('space.detail_members_view_all') }}
          </button>
        </div>
        <div v-else-if="memberLoadFailed" class="detail-announcement-state">
          <span class="detail-card__hint">{{ t('space.detail_members_load_failed') }}</span>
          <button type="button" class="detail-announcement__retry" @click="emit('retryMembers')">
            {{ t('common.retry') }}
          </button>
        </div>
        <p v-else class="detail-card__hint">{{ t('space.detail_members_empty') }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

const _props = defineProps<{
  showGroupInsights: boolean
  groupMemberCount: number
  groupOnlineCount: number
  announcementLoadFailed: boolean
  announcementSegments: Array<{ isLink: boolean; text: string }>
  canEditAnnouncement: boolean
  groupRoomId: string
  groupMembersPreview: MatrixRoomMember[]
  hasExpandableMembers: boolean
  showAllMembers: boolean
  memberLoadFailed: boolean
  selectedSessionRoomId: string | undefined
}>()

const emit = defineEmits<{
  retryAnnouncement: []
  openAnnouncementLink: [url: string]
  openAnnouncement: []
  retryMembers: []
  toggleShowAllMembers: []
  memberClick: [member: MatrixRoomMember]
  openMembersMode: [showDirectory: boolean]
}>()

const { t } = useI18n()
</script>
