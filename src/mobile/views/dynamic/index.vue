<template>
  <div class="flex flex-col overflow-auto h-full relative">
    <img
      src="@/assets/mobile/chat-home/background.webp"
      class="absolute fixed top-0 l-0 w-full h-full z-0 dark:opacity-20" />

    <NavBar>
      <template #center>
        <span>{{ t('space.title') }}</span>
      </template>
      <template #right>
        <van-button round plain size="small" @click="showCreateSpaceDialog = true">
          <svg class="w-16px h-16px"><use href="#plus"></use></svg>
        </van-button>
      </template>
    </NavBar>

    <!-- 加载状态 -->
    <van-loading v-if="spaceLoading" size="24px" class="flex justify-center py-40px z-1" />

    <!-- 空状态 -->
    <van-empty
      v-else-if="!spaceLoading && spaceList.length === 0"
      :description="t('space.empty')"
      class="z-1"
      :data-testid="'mobile-spaces-empty'">
      <van-button round type="primary" @click="showCreateSpaceDialog = true">
        {{ t('space.create') }}
      </van-button>
    </van-empty>

    <!-- 空间列表 -->
    <div v-else class="flex flex-col gap-10px px-16px mt-10px z-1">
      <div
        v-for="sp in spaceList"
        :key="sp.spaceId || sp.roomId"
        :data-testid="`mobile-space-item-${sp.spaceId || sp.roomId}`"
        class="rounded-12px bg-[--hula-surface-panel] overflow-hidden">
        <!-- 空间信息卡片 -->
        <div class="flex items-center gap-12px p-14px tap-highlight" @click="toggleSpaceDetail(sp)">
          <img
            class="size-48px rounded-12px object-cover flex-shrink-0"
            :src="sp.avatarUrl || '/logo.png'"
            :alt="sp.name"
            @error="($event.target as HTMLImageElement).src = '/logo.png'" />
          <div class="flex-1 min-w-0">
            <div class="text-15px font-500 text-[--hula-text-primary] truncate">{{ sp.name }}</div>
            <div class="text-12px text-[--hula-text-tertiary] truncate mt-2px">
              {{ sp.topic || t('space.topic_placeholder') }}
            </div>
          </div>
          <van-icon
            :name="expandedSpaceId === (sp.spaceId || sp.roomId) ? 'arrow-up' : 'arrow-down'"
            size="16"
            class="color-[--hula-text-tertiary] flex-shrink-0" />
        </div>

        <!-- 展开的成员列表 -->
        <div v-if="expandedSpaceId === (sp.spaceId || sp.roomId)" class="border-t border-[--hula-border-default]">
          <div v-if="memberLoadingMap[sp.spaceId || sp.roomId]" class="flex justify-center py-20px">
            <van-loading size="20px" />
          </div>
          <div
            v-else-if="spaceMemberMap[sp.spaceId || sp.roomId]?.length === 0"
            class="py-20px text-center text-13px text-[--hula-text-tertiary]">
            {{ t('space.management.no_members') }}
          </div>
          <div v-else>
            <div
              v-for="member in visibleMembers(sp.spaceId || sp.roomId)"
              :key="member.userId || member.uid"
              class="flex items-center gap-10px px-14px py-10px border-b border-[--hula-border-default] last:border-b-0">
              <img
                class="size-36px rounded-full object-cover"
                :src="member.avatarUrl || '/logo.png'"
                alt="成员头像"
                loading="lazy"
                decoding="async"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <div class="flex-1 min-w-0">
                <div class="text-13px text-[--hula-text-primary] truncate">
                  {{ member.displayName || member.userId || member.uid }}
                </div>
              </div>
            </div>
            <div
              v-if="
                !expandedMembers[sp.spaceId || sp.roomId] &&
                (spaceMemberMap[sp.spaceId || sp.roomId] || []).length > MEMBER_DISPLAY_LIMIT
              "
              class="py-10px text-center text-13px text-[--hula-color-primary] tap-highlight"
              @click="expandedMembers[sp.spaceId || sp.roomId] = true">
              {{
                t('space.management.show_all_members', {
                  count: (spaceMemberMap[sp.spaceId || sp.roomId] || []).length
                })
              }}
            </div>
          </div>
          <!-- 邀请按钮 -->
          <div class="px-14px py-10px border-t border-[--hula-border-default]">
            <van-button size="small" type="primary" plain block @click="showInviteDialog(sp)">
              {{ t('space.invite') }}
            </van-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建空间 Dialog -->
    <van-dialog
      v-model:show="showCreateSpaceDialog"
      :title="t('space.create')"
      show-cancel-button
      :confirm-button-text="t('common.confirm')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeCloseCreateSpace">
      <van-field
        v-model="newSpaceName"
        :placeholder="t('space.name_placeholder')"
        class="mx-16px mt-12px rounded-8px" />
      <van-field
        v-model="newSpaceTopic"
        :placeholder="t('space.topic_placeholder')"
        class="mx-16px mt-8px mb-12px rounded-8px" />
    </van-dialog>

    <!-- 邀请成员 Dialog -->
    <van-dialog
      v-model:show="showInviteMemberDialog"
      :title="t('space.invite_title')"
      show-cancel-button
      :confirm-button-text="t('common.confirm')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeCloseInviteMember">
      <van-field
        v-model="inviteUserId"
        :placeholder="t('space.invite_user_placeholder')"
        class="mx-16px my-12px rounded-8px" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import NavBar from '#/layout/navBar/index.vue'
import { matrixSpaceService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

interface SpaceItem {
  spaceId: string
  roomId: string
  name?: string
  topic?: string
  avatarUrl?: string
}

interface SpaceMemberItem {
  userId?: string
  uid?: string
  avatarUrl?: string
  displayName?: string
}

const logger = createLogger('MobileSpaces')
const { t } = useI18n()

const spaceLoading = ref(true)
const spaceList = ref<SpaceItem[]>([])
const expandedSpaceId = ref<string | null>(null)
const spaceMemberMap = ref<Record<string, SpaceMemberItem[]>>({})
const memberLoadingMap = ref<Record<string, boolean>>({})

const MEMBER_DISPLAY_LIMIT = 50
const expandedMembers = ref<Record<string, boolean>>({})

const visibleMembers = (key: string) => {
  const list = spaceMemberMap.value[key] || []
  return expandedMembers.value[key] ? list : list.slice(0, MEMBER_DISPLAY_LIMIT)
}

// Create space dialog
const showCreateSpaceDialog = ref(false)
const newSpaceName = ref('')
const newSpaceTopic = ref('')

// Invite member dialog
const showInviteMemberDialog = ref(false)
const inviteUserId = ref('')
const inviteTargetSpace = ref<SpaceItem | null>(null)

async function fetchSpaces() {
  spaceLoading.value = true
  try {
    const spaces = await matrixSpaceService.getUserSpaces()
    spaceList.value = (spaces || []) as unknown as SpaceItem[]
  } catch (e) {
    logger.error('Failed to fetch spaces:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('space.load_failed'))
  } finally {
    spaceLoading.value = false
  }
}

async function toggleSpaceDetail(sp: SpaceItem) {
  const spaceId = sp.spaceId || sp.roomId
  if (expandedSpaceId.value === spaceId) {
    expandedSpaceId.value = null
    return
  }

  expandedSpaceId.value = spaceId

  if (!spaceMemberMap.value[spaceId]) {
    memberLoadingMap.value[spaceId] = true
    try {
      const members = await matrixSpaceService.getSpaceMembers(spaceId)
      spaceMemberMap.value[spaceId] = (members || []) as SpaceMemberItem[]
    } catch (e) {
      logger.error('Failed to fetch space members:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('space.load_failed'))
      spaceMemberMap.value[spaceId] = []
    } finally {
      memberLoadingMap.value[spaceId] = false
    }
  }
}

function showInviteDialog(sp: SpaceItem) {
  inviteTargetSpace.value = sp
  inviteUserId.value = ''
  showInviteMemberDialog.value = true
}

async function beforeCloseCreateSpace(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showCreateSpaceDialog.value = false
    return true
  }

  const name = newSpaceName.value.trim()
  if (!name) {
    showFailToast(t('space.name_required'))
    return false
  }

  try {
    showToast({ type: 'loading', message: t('mobile_rooms.creating'), forbidClick: true })
    await matrixSpaceService.createSpace({
      name,
      topic: newSpaceTopic.value.trim() || undefined
    })
    showToast({ type: 'success', message: t('space.create_success') })
    showCreateSpaceDialog.value = false
    newSpaceName.value = ''
    newSpaceTopic.value = ''
    await fetchSpaces()
    return true
  } catch (e) {
    logger.error('Create space failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('space.create_failed'))
    return false
  }
}

async function beforeCloseInviteMember(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showInviteMemberDialog.value = false
    return true
  }

  const userId = inviteUserId.value.trim()
  if (!userId) {
    showFailToast(t('space.invite_user_required'))
    return false
  }

  const spaceId = inviteTargetSpace.value?.spaceId || inviteTargetSpace.value?.roomId
  if (!spaceId) return false

  try {
    showToast({ type: 'loading', message: t('mobile_rooms.joining'), forbidClick: true })
    await matrixSpaceService.inviteToSpace(spaceId, userId)
    showToast({ type: 'success', message: t('space.invite_success') })
    showInviteMemberDialog.value = false
    // Refresh members
    memberLoadingMap.value[spaceId] = true
    try {
      const members = await matrixSpaceService.getSpaceMembers(spaceId)
      spaceMemberMap.value[spaceId] = (members || []) as SpaceMemberItem[]
    } catch (e) {
      logger.error('Failed to refresh space members:', e)
    } finally {
      memberLoadingMap.value[spaceId] = false
    }
    return true
  } catch (e) {
    logger.error('Invite to space failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('space.invite_failed'))
    return false
  }
}

fetchSpaces()
</script>

<style scoped lang="scss">
.tap-highlight {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:active {
    background-color: var(--hula-bg-pressed);
  }
}

:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--hula-surface-search);
}
</style>
