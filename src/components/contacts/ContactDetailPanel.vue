<template>
  <n-drawer v-model:show="panelVisible" :width="340" placement="right" class="contact-detail-panel">
    <n-drawer-content :title="t('contacts.detail.title')" closable>
      <div v-if="loading" class="contact-loading">
        <SkeletonBase variant="avatar" :width="72" :height="72" />
        <SkeletonBase variant="text" width="60%" height="18px" />
        <SkeletonBase variant="text" width="40%" height="14px" />
      </div>

      <template v-else-if="profile">
        <div class="contact-profile">
          <n-avatar :size="72" :src="profile.avatarUrl" round />
          <div class="contact-names">
            <span class="contact-display-name">{{ profile.displayName }}</span>
            <span class="contact-mxid">{{ profile.userId }}</span>
          </div>
        </div>

        <n-divider />

        <div class="contact-actions">
          <n-button type="primary" block @click="startChat">
            <template #icon>
              <svg class="size-16px"><use href="#chat"></use></svg>
            </template>
            {{ t('contacts.detail.message') }}
          </n-button>
          <n-button data-testid="contact-report-btn" block @click="showReportDialog = true">
            <template #icon>
              <svg class="size-16px"><use href="#report"></use></svg>
            </template>
            {{ t('contacts.detail.report') }}
          </n-button>
        </div>
      </template>

      <n-empty v-else :description="t('contacts.detail.not_found')" />
    </n-drawer-content>

    <UserReportDialog
      v-model:show="showReportDialog"
      :user-id="userId"
      :user-display-name="profile?.displayName" />
  </n-drawer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SkeletonBase from '@/components/common/SkeletonBase.vue'
import UserReportDialog from '@/components/moderation/UserReportDialog.vue'
import profileService from '@/services/matrix/user/MatrixProfileService'
import { useGlobalStore } from '@/stores/domains/widget/global'

defineOptions({ name: 'ContactDetailPanel' })

const props = defineProps<{
  visible: boolean
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const globalStore = useGlobalStore()

const panelVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const profile = ref<{ userId: string; displayName: string; avatarUrl?: string } | null>(null)
const devices = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const showReportDialog = ref(false)

watch(
  () => props.userId,
  async (newId) => {
    if (!newId) {
      profile.value = null
      devices.value = []
      return
    }
    loading.value = true
    try {
      const [displayName, avatarUrl] = await Promise.all([
        profileService.getDisplayName(newId),
        profileService.getAvatarUrl(newId)
      ])

      profile.value = {
        userId: newId,
        displayName: displayName || newId,
        avatarUrl
      }
    } catch {
      profile.value = { userId: newId, displayName: newId }
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

function startChat() {
  if (!profile.value) return
  globalStore.currentSessionRoomId = profile.value.userId
  emit('close')
}
</script>

<style scoped lang="scss">
.contact-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
}

.contact-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0 16px;
}

.contact-names {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.contact-display-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--tjg-text-primary);
}

.contact-mxid {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  font-family: monospace;
}

.contact-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.contact-devices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.contact-section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--tjg-text-secondary);
  margin-bottom: 4px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--tjg-fill-default);

  &:hover {
    background: var(--tjg-fill-hover);
  }
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--tjg-fill-hover);
  color: var(--tjg-text-secondary);
  flex-shrink: 0;
}

.device-icon--primary {
  color: var(--tjg-color-primary-500);
}

.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.device-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-id {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  font-family: monospace;
}

.device-badge {
  flex-shrink: 0;
}
</style>
