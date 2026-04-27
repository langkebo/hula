<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('friend.request.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="friend-request-dialog"
    style="width: 400px; max-width: 90vw">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="incoming" :tab="t('friend.request.incoming')">
        <template #tab>
          <n-badge :value="incomingRequests.length" :max="99" :show="incomingRequests.length > 0">
            <span>{{ t('friend.request.incoming') }}</span>
          </n-badge>
        </template>
        <n-scrollbar style="max-height: 400px">
          <n-empty v-if="incomingRequests.length === 0" :description="t('friend.request.empty.incoming')" />
          <div v-else class="request-list">
            <div v-for="request in incomingRequests" :key="request.userId" class="request-item">
              <n-flex align="center" :size="12">
                <n-avatar
                  :size="48"
                  :src="AvatarUtils.getAvatarUrl(request.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <n-flex vertical :size="4" class="flex-1">
                  <span class="text-14px font-medium">{{ request.displayName || request.userId }}</span>
                  <span class="text-12px text-gray-500">{{ request.userId }}</span>
                  <span v-if="request.message" class="text-12px text-gray-400 truncate">
                    {{ request.message }}
                  </span>
                </n-flex>
              </n-flex>
              <n-flex :size="8" class="mt-8px">
                <n-button
                  type="primary"
                  size="small"
                  :loading="processing === request.userId"
                  @click="handleAccept(request)">
                  {{ t('friend.request.accept') }}
                </n-button>
                <n-button size="small" :loading="processing === request.userId" @click="handleReject(request)">
                  {{ t('friend.request.reject') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </n-scrollbar>
      </n-tab-pane>

      <n-tab-pane name="outgoing" :tab="t('friend.request.outgoing')">
        <n-scrollbar style="max-height: 400px">
          <n-empty v-if="outgoingRequests.length === 0" :description="t('friend.request.empty.outgoing')" />
          <div v-else class="request-list">
            <div v-for="request in outgoingRequests" :key="request.userId" class="request-item">
              <n-flex align="center" :size="12">
                <n-avatar
                  :size="48"
                  :src="AvatarUtils.getAvatarUrl(request.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <n-flex vertical :size="4" class="flex-1">
                  <span class="text-14px font-medium">{{ request.displayName || request.userId }}</span>
                  <span class="text-12px text-gray-500">{{ request.userId }}</span>
                  <span v-if="request.message" class="text-12px text-gray-400 truncate">
                    {{ request.message }}
                  </span>
                </n-flex>
              </n-flex>
              <n-flex :size="8" class="mt-8px">
                <n-button size="small" :loading="processing === request.userId" @click="handleCancel(request)">
                  {{ t('friend.request.cancel') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </n-scrollbar>
      </n-tab-pane>
    </n-tabs>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useContactStore, type FriendRequestItem } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()

const visible = defineModel<boolean>('show', { default: false })
const activeTab = ref<'incoming' | 'outgoing'>('incoming')
const processing = ref<string | null>(null)

const incomingRequests = computed(() => contactStore.requestFriendsList.filter((r) => r.direction === 'incoming'))

const outgoingRequests = computed(() => contactStore.requestFriendsList.filter((r) => r.direction === 'outgoing'))

const handleAccept = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.acceptFriendRequest(request.userId)
    window.$message.success(t('friend.request.success.accept'))
  } catch (err) {
    window.$message.error(t('friend.request.error.accept'))
  } finally {
    processing.value = null
  }
}

const handleReject = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.rejectFriendRequest(request.userId)
    window.$message.success(t('friend.request.success.reject'))
  } catch (err) {
    window.$message.error(t('friend.request.error.reject'))
  } finally {
    processing.value = null
  }
}

const handleCancel = async (request: FriendRequestItem) => {
  if (!request.userId) return
  processing.value = request.userId
  try {
    await contactStore.cancelFriendRequest(request.userId)
    window.$message.success(t('friend.request.success.cancel'))
  } catch (err) {
    window.$message.error(t('friend.request.error.cancel'))
  } finally {
    processing.value = null
  }
}

watch(visible, (val) => {
  if (val) {
    contactStore.loadFriendRequests()
  }
})
</script>

<style scoped lang="scss">
.friend-request-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 0 20px 20px;
  }
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.request-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}
</style>
