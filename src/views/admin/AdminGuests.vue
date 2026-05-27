<template>
  <div class="admin-guests">
    <!-- 访客访问设置 -->
    <div class="section-header">
      <h4>{{ t('admin.guests.access_settings') }}</h4>
    </div>
    <n-spin :show="guestInfoLoading">
      <n-card size="small" :bordered="false">
        <n-descriptions bordered :column="2" label-placement="left" size="small">
          <n-descriptions-item :label="t('admin.guests.guest_enabled')">
            <n-tag :type="guestInfo && guestInfo.guestCount > 0 ? 'success' : 'error'" size="small">
              {{ guestInfo && guestInfo.guestCount > 0 ? t('admin.common.confirm') : t('admin.common.cancel') }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item v-if="guestInfo" :label="t('admin.guests.guest_count')">
            {{ guestInfo.guestCount }}
          </n-descriptions-item>
          <n-descriptions-item v-if="guestInfo" :label="t('admin.guests.active_guest_count')">
            {{ guestInfo.activeGuestCount }}
          </n-descriptions-item>
          <n-descriptions-item v-if="guestInfo" :label="t('admin.guests.latest_guest')">
            {{ guestInfo.latestGuestUserId || '-' }}
          </n-descriptions-item>
          <n-descriptions-item v-if="guestInfo?.latestGuestCreatedAt" :label="t('admin.guests.created_at')">
            {{ new Date(guestInfo.latestGuestCreatedAt).toLocaleString() }}
          </n-descriptions-item>
        </n-descriptions>
        <n-space style="margin-top: 12px">
          <n-button size="small" @click="handleRefreshGuestInfo">
            <template #icon>
              <n-icon><Icon icon="mdi:refresh" /></n-icon>
            </template>
            {{ t('admin.common.refresh') }}
          </n-button>
        </n-space>
      </n-card>
    </n-spin>

    <n-divider />

    <!-- 访客账户列表 -->
    <div class="section-header">
      <h4>{{ t('admin.guests.guest_accounts') }}</h4>
      <n-button type="primary" size="small" @click="handleLoadGuestAccounts">
        {{ t('admin.guests.load_accounts') }}
      </n-button>
    </div>

    <n-spin :show="accountsLoading">
      <n-data-table
        v-if="guestAccounts.length > 0"
        :columns="accountColumns"
        :data="guestAccounts"
        :bordered="false"
        striped
        size="small"
        :row-key="(row: GuestAccountRow) => row.userId" />
      <n-empty v-else :description="t('admin.guests.no_accounts')" style="padding: 24px 0" />
    </n-spin>

    <n-divider />

    <!-- 访客房间访问 -->
    <div class="section-header">
      <h4>{{ t('admin.guests.room_access') }}</h4>
      <n-button size="small" @click="handleLoadRoomAccess">
        {{ t('admin.guests.load_rooms') }}
      </n-button>
    </div>

    <n-spin :show="roomAccessLoading">
      <n-data-table
        v-if="guestRooms.length > 0"
        :columns="roomColumns"
        :data="guestRooms"
        :bordered="false"
        striped
        size="small"
        :row-key="(row: GuestRoomRow) => row.roomId" />
      <n-empty v-else :description="t('admin.guests.no_rooms')" style="padding: 24px 0" />
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NSpace, NTag, useDialog } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import type { UserInfo } from '@/services/matrix/admin/AdminTypes'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminGuests')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

// ===== 访客信息 =====
const guestInfo = ref<{
  guestCount: number
  activeGuestCount: number
  latestGuestUserId?: string
  latestGuestCreatedAt?: number
} | null>(null)
const guestInfoLoading = ref(false)

function mapGuestAccount(user: UserInfo): GuestAccountRow {
  return {
    userId: user.userId || '-',
    displayName: user.displayname || '-',
    createdAt: user.createdTs,
    lastActive: user.lastSeenTs,
    isDeactivated: Boolean(user.deactivated)
  }
}

async function fetchGuestAccounts(limit = 200): Promise<GuestAccountRow[]> {
  const result = await adminService.getUsers(limit, undefined, undefined, true)
  const users = Array.isArray(result.users) ? result.users : []
  return users.map(mapGuestAccount)
}

async function loadGuestInfo() {
  guestInfoLoading.value = true
  try {
    const accounts = await fetchGuestAccounts()
    const latestGuest = [...accounts]
      .filter((account) => typeof account.createdAt === 'number')
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0]

    guestAccounts.value = accounts
    guestInfo.value = {
      guestCount: accounts.length,
      activeGuestCount: accounts.filter((account) => !account.isDeactivated).length,
      latestGuestUserId: latestGuest?.userId,
      latestGuestCreatedAt: latestGuest?.createdAt
    }
  } catch (e) {
    logger.error('获取访客信息失败', e)
    guestInfo.value = null
    guestAccounts.value = []
  } finally {
    guestInfoLoading.value = false
  }
}

function handleRefreshGuestInfo() {
  void loadGuestInfo()
}

// ===== 访客账户列表 =====
interface GuestAccountRow {
  userId: string
  displayName: string
  createdAt?: number
  lastActive?: number
  isDeactivated: boolean
}

const guestAccounts = ref<GuestAccountRow[]>([])
const accountsLoading = ref(false)

async function handleLoadGuestAccounts() {
  accountsLoading.value = true
  try {
    guestAccounts.value = await fetchGuestAccounts()
  } catch (e) {
    logger.error('获取访客账户失败', e)
    guestAccounts.value = []
    showFeedback(t('admin.guests.load_accounts_failed'), 'error')
  } finally {
    accountsLoading.value = false
  }
}

// ===== 访客房间访问 =====
interface GuestRoomRow {
  userId: string
  roomId: string
  roomName: string
  accessLevel: string
}

const guestRooms = ref<GuestRoomRow[]>([])
const roomAccessLoading = ref(false)

async function handleLoadRoomAccess() {
  roomAccessLoading.value = true
  try {
    const accounts = guestAccounts.value.length > 0 ? guestAccounts.value : await fetchGuestAccounts()
    guestAccounts.value = accounts

    if (accounts.length === 0) {
      guestRooms.value = []
      return
    }

    const roomRows = await Promise.all(
      accounts.map(async (account) => {
        const rooms = await adminService.getUserRooms(account.userId)
        return rooms.map((room) => ({
          userId: account.userId,
          roomId: room.roomId,
          roomName: room.roomId,
          accessLevel: room.membership || t('admin.guests.access_level_joined')
        }))
      })
    )

    guestRooms.value = roomRows.flat()
  } catch (e) {
    logger.error('获取访客房间访问失败', e)
    guestRooms.value = []
    showFeedback(t('admin.guests.load_rooms_failed'), 'error')
  } finally {
    roomAccessLoading.value = false
  }
}

// ===== 表格列定义 =====
const accountColumns = computed(() => [
  {
    title: t('admin.users.userId'),
    key: 'userId',
    ellipsis: { tooltip: true },
    width: 260
  },
  {
    title: t('admin.users.displayName'),
    key: 'displayName',
    width: 150
  },
  {
    title: t('admin.guests.created_at'),
    key: 'createdAt',
    width: 180,
    render(row: GuestAccountRow) {
      return row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.guests.last_active'),
    key: 'lastActive',
    width: 180,
    render(row: GuestAccountRow) {
      return row.lastActive ? new Date(row.lastActive).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 120,
    render(row: GuestAccountRow) {
      return h(
        NButton,
        {
          size: 'small',
          type: 'error',
          onClick: () => handleDeactivateGuest(row)
        },
        () => t('admin.guests.deactivate')
      )
    }
  }
])

const roomColumns = computed(() => [
  {
    title: t('admin.guests.user_id'),
    key: 'userId',
    ellipsis: { tooltip: true },
    width: 260
  },
  {
    title: t('admin.rooms.roomId'),
    key: 'roomId',
    ellipsis: { tooltip: true },
    width: 300
  },
  {
    title: t('admin.rooms.name'),
    key: 'roomName',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.guests.access_level'),
    key: 'accessLevel',
    width: 150,
    render(row: GuestRoomRow) {
      return h(NTag, { type: 'info', size: 'small' }, () => row.accessLevel)
    }
  }
])

function handleDeactivateGuest(account: GuestAccountRow) {
  dialog.warning({
    title: t('admin.guests.deactivate_title'),
    content: t('admin.guests.deactivate_confirm', { userId: account.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await adminService.deactivateUser(account.userId)
        showFeedback(t('admin.guests.deactivated_success'), 'success')
        void handleLoadGuestAccounts()
      } catch (e) {
        logger.error('停用访客账户失败', e)
        showFeedback(t('admin.guests.deactivate_failed'), 'error')
      }
    }
  })
}

onMounted(() => {
  void loadGuestInfo()
})
</script>

<style scoped lang="scss">
.admin-guests {
  max-width: 1200px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
}
</style>
