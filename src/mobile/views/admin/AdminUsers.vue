<template>
  <mobile-layout :title="t('admin.users')" show-back>
    <div class="mobile-admin-users">
      <!-- 搜索栏 -->
      <van-search
        v-model="searchQuery"
        :placeholder="t('admin.search_users')"
        @search="onRefresh" />

      <!-- 用户列表 -->
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list v-model:loading="loading" :finished="true" :finished-text="t('common.no_more')">
          <van-cell
            v-for="user in displayedUsers"
            :key="user.userId"
            :title="user.displayName || user.userId"
            :label="user.userId"
            is-link
            @click="handleUserClick(user)">
            <template #icon>
              <van-image
                :src="user.avatarUrl"
                round
                width="40"
                height="40"
                fit="cover" />
            </template>
            <template #value>
              <van-tag v-if="user.isAdmin" type="danger">{{ t('admin.admin') }}</van-tag>
              <van-tag v-else-if="user.isActive" type="success">{{ t('admin.active') }}</van-tag>
              <van-tag v-else type="default">{{ t('admin.inactive') }}</van-tag>
            </template>
          </van-cell>
        </van-list>
      </van-pull-refresh>

      <!-- 用户详情弹出层 -->
      <van-popup v-model:show="showUserDetail" position="bottom" :style="{ height: '70%' }">
        <div v-if="selectedDisplayUser" class="user-detail">
          <div class="user-header">
            <van-image
              :src="selectedDisplayUser.avatarUrl"
              round
              width="60"
              height="60"
              fit="cover" />
            <div class="user-info">
              <h3>{{ selectedDisplayUser.displayName || selectedDisplayUser.userId }}</h3>
              <p>{{ selectedDisplayUser.userId }}</p>
            </div>
          </div>
          <van-divider />
          <van-cell-group>
            <van-cell :title="t('admin.user_status')" :value="selectedDisplayUser.isActive ? t('admin.active') : t('admin.inactive')" />
            <van-cell :title="t('admin.user_role')" :value="selectedDisplayUser.isAdmin ? t('admin.admin') : t('admin.user')" />
          </van-cell-group>
          <div class="user-actions">
            <van-button
              v-if="!selectedDisplayUser.isAdmin"
              type="warning"
              block
              @click="handleDeactivateUser">
              {{ selectedDisplayUser.isActive ? t('admin.deactivate') : t('admin.activate') }}
            </van-button>
            <van-button
              v-if="!selectedDisplayUser.isAdmin"
              type="danger"
              block
              @click="handleDeactivateUser">
              {{ t('admin.delete_user') }}
            </van-button>
          </div>
        </div>
      </van-popup>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, showConfirmDialog } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminUsers } from '@/composables/admin'
import type { UserInfo } from '@/services/matrix/admin/MatrixAdminService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminUsers')
const { t } = useI18n()

// Shared business logic with the desktop AdminUsers view.
const admin = useAdminUsers()

// View-only state (UI affordances only).
const refreshing = ref(false)
const showUserDetail = ref(false)

// Local aliases so the template stays close to the composable contract.
const searchQuery = admin.searchQuery
const loading = admin.loading

interface UserDisplay {
  userId: string
  displayName?: string
  avatarUrl?: string
  isAdmin: boolean
  isActive: boolean
}

function toDisplay(u: UserInfo): UserDisplay {
  return {
    userId: u.userId,
    displayName: u.displayname || u.name,
    avatarUrl: u.avatarUrl,
    isAdmin: u.admin ?? false,
    isActive: !u.deactivated
  }
}

const displayedUsers = computed<UserDisplay[]>(() => admin.filteredUsers.value.map(toDisplay))
const selectedDisplayUser = computed<UserDisplay | null>(() =>
  admin.selectedUser.value ? toDisplay(admin.selectedUser.value) : null
)

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadUsers(200)
  } catch (error) {
    logger.error('[MobileAdminUsers] 加载用户失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const handleUserClick = async (user: UserDisplay) => {
  const full = admin.users.value.find((u) => u.userId === user.userId)
  if (!full) return
  showUserDetail.value = true
  await admin.selectUser(full)
}

const handleDeactivateUser = async () => {
  if (!admin.selectedUser.value) return

  try {
    await showConfirmDialog({
      title: t('admin.confirm'),
      message: admin.selectedUser.value.deactivated ? t('admin.activate_confirm') : t('admin.deactivate_confirm')
    })

    await admin.deactivateUser(admin.selectedUser.value.userId)
    showToast(t('admin.operation_success'))
    showUserDetail.value = false
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('[MobileAdminUsers] 操作失败:', error)
      showToast(t('admin.load_failed'))
    }
  }
}

// Initial load.
onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-users {
  .van-search {
    padding: 12px 16px;
  }

  .van-cell {
    padding: 12px 16px;

    :deep(.van-cell__icon) {
      margin-right: 12px;
    }
  }
}

.user-detail {
  padding: 16px;

  .user-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;

    .user-info {
      flex: 1;

      h3 {
        margin: 0 0 4px 0;
        font-size: 18px;
        font-weight: 600;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--van-text-color-2);
      }
    }
  }

  .user-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
}
</style>
