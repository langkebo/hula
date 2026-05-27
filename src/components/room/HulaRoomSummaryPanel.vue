<template>
  <div class="hula-room-summary-panel" :class="{ 'is-empty': !roomId }">
    <template v-if="!roomId">
      <div class="pane-empty">
        <div class="pane-empty__icon-shell">
          <svg class="size-48px color-[--hula-text-tertiary]"><use href="#view-grid-card"></use></svg>
        </div>
        <p class="empty-text">{{ t('room.detail.no_selection') }}</p>
      </div>
    </template>

    <template v-else>
      <div class="pane-loading" v-if="loading">
        <n-spin size="medium" />
      </div>

      <template v-else-if="hasPermission === false">
        <div class="pane-no-permission">
          <div class="pane-no-permission__icon-shell">
            <svg class="size-48px color-[--hula-text-tertiary]"><use href="#lock"></use></svg>
          </div>
          <h3 class="no-permission-title">{{ t('space.detail_permission_denied_title') }}</h3>
          <p class="no-permission-desc">{{ t('space.detail_permission_denied_description') }}</p>

          <div class="mt-24px w-full px-20px">
            <HulaSpaceJoinCta :space-id="roomId" :membership="membership" @success="emit('refresh')" />
          </div>
        </div>
      </template>

      <template v-else-if="detail">
        <!-- 头部概览 -->
        <div class="pane-header">
          <div class="header-main">
            <n-avatar
              class="header-avatar"
              round
              :size="64"
              :src="AvatarUtils.getAvatarUrl(detail.avatarUrl || '')"
              :fallback-src="fallbackAvatar" />
            <div class="header-info">
              <h3 class="room-name">{{ detail.name }}</h3>
              <n-flex :size="4" align="center">
                <n-tag v-if="isPublic" size="tiny" type="info" :bordered="false" round>
                  {{ t('room.detail.public') }}
                </n-tag>
                <n-tag v-else size="tiny" :bordered="false" round>
                  {{ t('room.detail.private') }}
                </n-tag>
                <n-tag v-if="detail.isEncrypted" size="tiny" :bordered="false" round>
                  {{ t('room.detail.encrypted') }}
                </n-tag>
                <span class="room-id-text" :title="roomId">{{ truncateId(roomId) }}</span>
              </n-flex>
            </div>
          </div>
        </div>

        <div class="pane-body">
          <!-- 统计信息 -->
          <div class="detail-card">
            <dl class="detail-meta">
              <div class="detail-meta__row">
                <dt>{{ t('room.detail.topic') }}</dt>
                <dd class="detail-meta__text" :class="{ 'is-empty': !detail.topic }">
                  {{ detail.topic || t('room.detail.no_topic') }}
                </dd>
              </div>
              <div class="detail-meta__row">
                <dt>{{ t('room.detail.members') }}</dt>
                <dd>{{ detail.memberCount }}</dd>
              </div>
              <div v-if="onlineCount > 0" class="detail-meta__row">
                <dt>{{ t('room.detail.online') }}</dt>
                <dd class="color-[--hula-color-success-500]">{{ onlineCount }}</dd>
              </div>
            </dl>
          </div>

          <!-- 所属空间 -->
          <div class="detail-card">
            <RoomParentSpaces :room-id="roomId!" />
          </div>

          <!-- 模式切换：邀请/设置 -->
          <Transition name="fade-slide" mode="out-in">
            <div v-if="inviteMode" class="detail-card detail-card--action" key="invite">
              <div class="detail-card__title">{{ t('space.invite_title') }}</div>
              <n-form label-placement="top" :show-feedback="false" class="mt-12px">
                <n-form-item :label="t('space.invite')">
                  <n-input
                    :value="inviteUserId"
                    round
                    :placeholder="t('space.invite_user_placeholder')"
                    @update:value="emit('update:inviteUserId', $event)" />
                </n-form-item>
                <n-flex justify="flex-end" :size="8" class="mt-16px">
                  <n-button size="small" @click="emit('closeInvite')">{{ t('common.cancel') }}</n-button>
                  <n-button
                    size="small"
                    type="primary"
                    :loading="inviting"
                    :disabled="!inviteUserId?.trim()"
                    @click="emit('submitInvite')">
                    {{ t('common.confirm') }}
                  </n-button>
                </n-flex>
              </n-form>
            </div>

            <div v-else-if="settingsMode" class="detail-card detail-card--action" key="settings">
              <div class="detail-card__title">{{ t('room.detail.settings') }}</div>
              <n-form label-placement="top" :show-feedback="false" class="mt-12px">
                <n-form-item :label="t('room.create.name')">
                  <n-input
                    :value="settingsName"
                    round
                    :placeholder="t('room.create.name_placeholder')"
                    @update:value="emit('update:settingsName', $event)" />
                </n-form-item>
                <n-form-item :label="t('room.create.topic')">
                  <n-input
                    :value="settingsTopic"
                    type="textarea"
                    :rows="3"
                    round
                    :placeholder="t('room.create.topic_placeholder')"
                    @update:value="emit('update:settingsTopic', $event)" />
                </n-form-item>
                <n-flex justify="flex-end" :size="8" class="mt-16px">
                  <n-button size="small" @click="emit('closeSettings')">{{ t('common.cancel') }}</n-button>
                  <n-button
                    size="small"
                    type="primary"
                    :loading="settingsSubmitting"
                    :disabled="!settingsName?.trim()"
                    @click="emit('submitSettings')">
                    {{ t('common.confirm') }}
                  </n-button>
                </n-flex>
              </n-form>
            </div>

            <!-- 默认操作按钮 -->
            <div v-else class="action-section" key="default">
              <n-button type="primary" block class="h-40px rounded-10px" @click="emit('enterRoom')">
                <template #icon>
                  <svg class="size-16px"><use href="#message"></use></svg>
                </template>
                {{ t('room.detail.enter_chat') }}
              </n-button>

              <n-flex :size="8" class="mt-12px">
                <n-button secondary class="flex-1 rounded-10px" @click="emit('settings')">
                  <template #icon>
                    <svg class="size-14px"><use href="#setting"></use></svg>
                  </template>
                  {{ t('room.detail.settings') }}
                </n-button>
                <n-button v-if="canInvite" secondary class="flex-1 rounded-10px" @click="emit('invite')">
                  <template #icon>
                    <svg class="size-14px"><use href="#add-user"></use></svg>
                  </template>
                  {{ t('room.detail.invite') }}
                </n-button>
              </n-flex>
            </div>
          </Transition>
        </div>
      </template>

      <template v-else>
        <div class="pane-error">
          <p class="color-[--hula-text-tertiary]">{{ t('room.detail.load_failed') }}</p>
          <n-button size="small" secondary class="mt-12px" @click="loadDetail">
            {{ t('common.retry') }}
          </n-button>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RoomParentSpaces from '@/components/space/RoomParentSpaces.vue'
import HulaSpaceJoinCta from '@/components/workbench/HulaSpaceJoinCta.vue'
import { ThemeEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { type MatrixGroupInfo, useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import type { Room } from '@/types/matrix-services'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  roomId: string | null
  inviteMode?: boolean
  inviteUserId?: string
  inviting?: boolean
  settingsMode?: boolean
  settingsName?: string
  settingsTopic?: string
  settingsSubmitting?: boolean
  refreshVersion?: number
}>()

const emit = defineEmits<{
  enterRoom: []
  settings: []
  invite: []
  closeInvite: []
  submitInvite: []
  closeSettings: []
  submitSettings: []
  refresh: []
  'update:inviteUserId': [value: string]
  'update:settingsName': [value: string]
  'update:settingsTopic': [value: string]
}>()

const { t } = useI18n()
const groupStore = useGroupStore()
const settingStore = useSettingStore()

const loading = ref(false)
const detail = ref<MatrixGroupInfo | null>(null)
const hasPermission = ref<boolean | null>(null)
const membership = ref<string | undefined>(undefined)

const fallbackAvatar = computed(() => (settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'))

const isPublic = computed(() => detail.value?.isPublic || detail.value?.joinRule === 'public')
const onlineCount = computed(() => (props.roomId ? groupStore.onlineCountMap[props.roomId] : 0) ?? 0)
const canInvite = computed(() => {
  const client = matrixClientService.getClient()
  const room = props.roomId ? client?.getRoom(props.roomId) : null
  const userId = client?.getUserId()
  if (!room || !userId) return false
  return room.canInvite(userId)
})

const truncateId = (id: string | null) => {
  if (!id) return ''
  if (id.length <= 20) return id
  return `${id.slice(0, 10)}...${id.slice(-6)}`
}

const loadDetail = async () => {
  if (!props.roomId) return

  loading.value = true
  try {
    const client = matrixClientService.getClient()
    if (client && props.roomId) {
      const room = client.getRoom(props.roomId)
      if (room && typeof room.getMyMembership === 'function') {
        membership.value = room.getMyMembership()
      } else {
        membership.value = undefined
      }
    }

    // 如果没有加入且不是公开房间，可能没有权限
    const summary = await groupStore.loadGroupInfo(props.roomId)
    if (summary) {
      detail.value = summary
      hasPermission.value = true
    } else {
      hasPermission.value = false
    }
  } catch (err) {
    hasPermission.value = false
  } finally {
    loading.value = false
  }
}

watch(() => props.roomId, loadDetail, { immediate: true })
watch(() => props.refreshVersion, loadDetail)
</script>

<style scoped lang="scss">
.hula-room-summary-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-panel-muted);
}

.pane-empty,
.pane-no-permission,
.pane-loading,
.pane-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 24px;
  text-align: center;
}

.pane-empty__icon-shell,
.pane-no-permission__icon-shell {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  background: var(--hula-surface-panel);
  margin-bottom: 20px;
  border: 1px solid var(--hula-border-default);
}

.empty-text,
.no-permission-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.no-permission-desc {
  margin-top: 8px;
  font-size: 13px;
  color: var(--hula-text-secondary);
  line-height: 1.6;
}

.pane-header {
  padding: 24px 20px;
  background: var(--hula-surface-panel);
  border-bottom: 1px solid var(--hula-border-default);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--hula-text-primary);
  margin: 0 0 4px;
}

.room-id-text {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.pane-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-card {
  padding: 16px;
  background: var(--hula-surface-panel);
  border-radius: 12px;
  border: 1px solid var(--hula-border-default);

  &__title {
    font-size: 12px;
    font-weight: 600;
    color: var(--hula-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    font-size: 13px;

    dt {
      color: var(--hula-text-tertiary);
      flex-shrink: 0;
    }
    dd {
      color: var(--hula-text-primary);
      text-align: right;
    }
  }

  &__text {
    word-break: break-word;
    text-align: left !important;
    &.is-empty {
      color: var(--hula-text-disabled);
      font-style: italic;
    }
  }
}

.action-section {
  padding: 4px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
