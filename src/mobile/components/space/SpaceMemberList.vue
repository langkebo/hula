<template>
  <div class="space-member-list" data-testid="space-member-list">
    <MobileAsyncState
      :state="asyncState"
      test-id="space-members"
      :error-text="t('space.members_load_failed')"
      :error-detail="errorDetail"
      :empty-text="t('space.members_empty')"
      min-height="160px"
      @retry="load">
      <div class="member-rows">
        <div v-for="member in members" :key="member.userId" class="member-row" :data-user-id="member.userId">
          <img
            class="member-avatar"
            :src="AvatarUtils.getAvatarUrl(member.avatarUrl, 64)"
            :alt="member.displayName"
            @error="handleAvatarError" />
          <div class="member-main">
            <span class="member-name">{{ member.displayName }}</span>
            <span class="member-role">{{ roleLabel(member) }}</span>
          </div>
          <div v-if="canManage && canActOn(member)" class="member-actions" data-testid="member-actions">
            <van-button
              v-if="member.powerLevel < ADMIN_POWER_LEVEL"
              size="mini"
              plain
              type="primary"
              :disabled="mutating"
              data-testid="member-set-admin"
              @click="handleSetAdmin(member)">
              {{ t('space.members_action_admin') }}
            </van-button>
            <van-button
              size="mini"
              plain
              type="danger"
              :disabled="mutating"
              data-testid="member-remove"
              @click="handleRemove(member)">
              {{ t('space.members_action_remove') }}
            </van-button>
          </div>
        </div>
      </div>
    </MobileAsyncState>
  </div>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { useMobileErrorText } from '@/mobile/composables/useMobileErrorText'
import { matrixSpaceService, type SpaceMemberDetail } from '@/services/matrix/room/MatrixSpaceService'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

defineOptions({ name: 'SpaceMemberList' })

/** 管理员 power level */
const ADMIN_POWER_LEVEL = 100
/** 可管理成员的 power level 门槛（管理员 / 版主） */
const MANAGE_POWER_LEVEL = 50

const props = defineProps<{
  spaceId: string
  canManage: boolean
}>()

const { t } = useI18n()
const { resolve } = useMobileErrorText()
const logger = createLogger('SpaceMemberList')

const members = ref<SpaceMemberDetail[]>([])
const loading = ref(false)
const mutating = ref(false)
const errorDetail = ref('')

const asyncState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (loading.value) return 'loading'
  if (errorDetail.value) return 'error'
  return members.value.length === 0 ? 'empty' : 'ready'
})

const roleLabel = (member: SpaceMemberDetail): string => {
  if (member.isCreator) return t('space.members_role_creator')
  if (member.powerLevel >= MANAGE_POWER_LEVEL) return t('space.members_role_admin')
  return t('space.members_role_member')
}

const canActOn = (member: SpaceMemberDetail): boolean => !member.isCreator && !member.isSelf

const load = async () => {
  if (!props.spaceId) {
    members.value = []
    return
  }
  loading.value = true
  errorDetail.value = ''
  try {
    members.value = await matrixSpaceService.getSpaceMemberDetails(props.spaceId)
  } catch (err) {
    logger.error('Failed to load space members', err)
    members.value = []
    errorDetail.value = resolve(err)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.spaceId,
  () => void load(),
  { immediate: true }
)

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = AvatarUtils.getAvatarUrl(null)
}

const handleSetAdmin = async (member: SpaceMemberDetail) => {
  try {
    await showConfirmDialog({
      title: t('space.members_action_admin'),
      message: t('space.members_admin_confirm', { name: member.displayName })
    })
  } catch {
    return
  }
  mutating.value = true
  try {
    await matrixSpaceService.setSpaceMemberRole(props.spaceId, member.userId, 'admin')
    showToast(t('space.members_action_success'))
    await load()
  } catch (err) {
    logger.error('Failed to set space member role', err)
    showToast(resolve(err))
  } finally {
    mutating.value = false
  }
}

const handleRemove = async (member: SpaceMemberDetail) => {
  try {
    await showConfirmDialog({
      title: t('space.members_action_remove'),
      message: t('space.members_remove_confirm', { name: member.displayName })
    })
  } catch {
    return
  }
  mutating.value = true
  try {
    await matrixSpaceService.removeFromSpace(props.spaceId, member.userId)
    showToast(t('space.members_action_success'))
    await load()
  } catch (err) {
    logger.error('Failed to remove space member', err)
    showToast(resolve(err))
  } finally {
    mutating.value = false
  }
}
</script>

<style scoped lang="scss">
.space-member-list {
  width: 100%;
}

.member-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--tjg-glass-row-bg);
  border: var(--tjg-glass-border-soft);
  border-radius: var(--tjg-radius-lg);
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--tjg-radius-full);
  object-fit: cover;
  flex-shrink: 0;
}

.member-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: var(--tjg-font-size-md);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
</style>
