<template>
  <mobile-layout :title="t('admin.federation')" show-back>
    <div class="mobile-admin-federation">
      <van-tabs v-model:active="activeTab" sticky>
        <van-tab :title="t('admin.destinations')" name="destinations">
          <van-pull-refresh v-model="refreshing" @refresh="reloadDestinations">
            <van-list :finished="true" :finished-text="t('common.no_more')">
              <van-cell
                v-for="dest in admin.destinations.value"
                :key="dest.destination"
                :title="dest.destination"
                is-link
                @click="handleDestClick(dest)">
                <template #label>
                  <span v-if="dest.failureTs" class="failure">{{ t('admin.failed') }}</span>
                  <span v-else class="ok">{{ t('admin.healthy') }}</span>
                </template>
              </van-cell>
            </van-list>
          </van-pull-refresh>
        </van-tab>

        <van-tab :title="t('admin.blacklist')" name="blacklist">
          <div class="blacklist-actions">
            <van-button type="primary" size="small" block @click="showAddDialog = true">
              {{ t('admin.add_blacklist') }}
            </van-button>
          </div>
          <van-cell-group>
            <van-swipe-cell v-for="item in admin.blacklist.value" :key="item.domain">
              <van-cell :title="item.domain" :label="item.reason" />
              <template #right>
                <van-button
                  square
                  type="danger"
                  :text="t('admin.remove')"
                  @click="handleRemoveBlacklist(item.domain)" />
              </template>
            </van-swipe-cell>
          </van-cell-group>
        </van-tab>
      </van-tabs>

      <van-popup v-model:show="showDestDetail" position="bottom" :style="{ height: '50%' }">
        <div v-if="admin.selectedDestination.value" class="dest-detail">
          <h3>{{ admin.selectedDestination.value.destination }}</h3>
          <van-divider />
          <van-cell-group>
            <van-cell
              :title="t('admin.last_failure')"
              :value="
                admin.selectedDestination.value.failureTs
                  ? new Date(admin.selectedDestination.value.failureTs).toLocaleString()
                  : '-'
              " />
            <van-cell
              :title="t('admin.retry_interval')"
              :value="
                admin.selectedDestination.value.retryInterval
                  ? `${admin.selectedDestination.value.retryInterval}ms`
                  : '-'
              " />
          </van-cell-group>
          <div class="dest-actions">
            <van-button type="primary" block @click="handleReset">{{ t('admin.reset_connection') }}</van-button>
            <van-button type="success" block @click="handleReconnect">{{ t('admin.reconnect') }}</van-button>
          </div>
        </div>
      </van-popup>

      <van-dialog
        v-model:show="showAddDialog"
        :title="t('admin.add_blacklist')"
        show-cancel-button
        @confirm="handleAddBlacklist">
        <van-field v-model="newDomain" :label="t('admin.domain')" :placeholder="t('admin.domain_placeholder')" />
        <van-field v-model="newReason" :label="t('admin.reason')" :placeholder="t('admin.reason_placeholder')" />
      </van-dialog>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminFederation } from '@/composables/admin'
import type { FederationDestination } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminFederation')
const { t } = useI18n()

const admin = useAdminFederation()
const activeTab = ref<'destinations' | 'blacklist'>('destinations')
const refreshing = ref(false)
const showDestDetail = ref(false)
const showAddDialog = ref(false)
const newDomain = ref('')
const newReason = ref('')

const reloadDestinations = async () => {
  refreshing.value = true
  try {
    await admin.loadDestinations()
  } catch (error) {
    logger.error('[MobileAdminFederation] 加载联邦目标失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const reloadBlacklist = async () => {
  try {
    await admin.loadBlacklist()
  } catch (error) {
    logger.error('[MobileAdminFederation] 加载黑名单失败:', error)
    showToast(t('admin.load_failed'))
  }
}

watch(activeTab, (v) => {
  if (v === 'destinations') reloadDestinations()
  else reloadBlacklist()
})

const handleDestClick = (dest: FederationDestination) => {
  admin.selectDestination(dest)
  showDestDetail.value = true
}

const handleReset = async () => {
  if (!admin.selectedDestination.value) return
  try {
    await admin.resetFederationConnection(admin.selectedDestination.value.destination)
    showToast(t('admin.operation_success'))
    showDestDetail.value = false
  } catch (error) {
    logger.error('[MobileAdminFederation] 重置连接失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleReconnect = async () => {
  if (!admin.selectedDestination.value) return
  try {
    await admin.reconnectFederation(admin.selectedDestination.value.destination)
    showToast(t('admin.operation_success'))
    showDestDetail.value = false
  } catch (error) {
    logger.error('[MobileAdminFederation] 重连失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleAddBlacklist = async () => {
  if (!newDomain.value.trim()) return
  try {
    const ok = await admin.addToBlacklist(newDomain.value.trim(), newReason.value.trim() || undefined)
    if (ok) {
      showToast(t('admin.operation_success'))
      newDomain.value = ''
      newReason.value = ''
    } else {
      showToast(t('admin.load_failed'))
    }
  } catch (error) {
    logger.error('[MobileAdminFederation] 添加黑名单失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleRemoveBlacklist = async (domain: string) => {
  try {
    const ok = await admin.removeFromBlacklist(domain)
    if (ok) showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminFederation] 移除黑名单失败:', error)
    showToast(t('admin.load_failed'))
  }
}

reloadDestinations()
</script>

<style scoped lang="scss">
.mobile-admin-federation {
  .blacklist-actions {
    padding: 12px 16px;
  }
  .failure {
    color: var(--van-danger-color);
  }
  .ok {
    color: var(--van-success-color);
  }
}
.dest-detail {
  padding: 16px;
  h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    word-break: break-all;
  }
  .dest-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 16px;
  }
}
</style>
