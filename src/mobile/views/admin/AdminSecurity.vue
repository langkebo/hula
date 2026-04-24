<template>
  <mobile-layout :title="t('admin.security.title')" show-back>
    <div class="mobile-admin-security">
      <van-notice-bar :scrollable="false" mode="closeable" color="#9a5a00" background="#fff8e6">
        {{ t('admin.feature_not_ready') }}
      </van-notice-bar>

      <van-tabs v-model:active="tab">
        <van-tab :title="t('admin.security.events_tab')" name="events">
          <van-pull-refresh v-model="refreshingEvents" @refresh="onRefreshEvents">
            <van-cell-group inset>
              <van-cell
                v-for="(ev, idx) in admin.events.value"
                :key="idx"
                :title="(ev.type as string) || '-'"
                :label="(ev.description as string) || (ev.ip as string) || ''" />
              <van-empty v-if="!admin.events.value.length" :description="t('admin.no_data')" />
            </van-cell-group>
          </van-pull-refresh>
        </van-tab>

        <van-tab :title="t('admin.security.ip_blocks_tab')" name="ips">
          <van-pull-refresh v-model="refreshingIps" @refresh="onRefreshIps">
            <van-cell-group inset>
              <van-cell
                v-for="(block, idx) in admin.ipBlocks.value"
                :key="idx"
                :title="(block.ip as string) || '-'"
                :label="(block.reason as string) || ''">
                <template #right-icon>
                  <van-button size="mini" type="danger" @click="onUnblock(block.ip as string)">
                    {{ t('admin.security.unblock') }}
                  </van-button>
                </template>
              </van-cell>
              <van-empty v-if="!admin.ipBlocks.value.length" :description="t('admin.no_data')" />
            </van-cell-group>
          </van-pull-refresh>
        </van-tab>
      </van-tabs>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminSecurity } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminSecurity')
const { t } = useI18n()

const admin = useAdminSecurity()
const tab = ref<'events' | 'ips'>('events')
const refreshingEvents = ref(false)
const refreshingIps = ref(false)

const onRefreshEvents = async () => {
  refreshingEvents.value = true
  try {
    await admin.loadEvents()
  } catch (error) {
    logger.error('[MobileAdminSecurity] events load failed', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshingEvents.value = false
  }
}

const onRefreshIps = async () => {
  refreshingIps.value = true
  try {
    await admin.loadIpBlocks()
  } catch (error) {
    logger.error('[MobileAdminSecurity] ip blocks load failed', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshingIps.value = false
  }
}

const onUnblock = async (ip: string) => {
  try {
    await admin.unblockIp(ip)
    showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminSecurity] unblock failed', error)
    showToast(t('admin.load_failed'))
  }
}

onRefreshEvents()
onRefreshIps()
</script>

<style scoped lang="scss">
.mobile-admin-security {
  padding-bottom: 16px;
}
</style>
