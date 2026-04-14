<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_login_history.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_login_history.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_login_history.subtitle') }}</div>

          <van-cell-group inset>
            <van-cell
              v-for="record in loginHistory"
              :key="record.deviceId"
              :title="record.deviceName || t('mobile_login_history.unnamed_device')"
              :label="formatLabel(record)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                  <Icon :icon="getDeviceIcon(record.userAgent)" :width="20" color="#666" />
                </div>
              </template>
              <template #right-icon>
                <van-tag v-if="isCurrentDevice(record.deviceId)" type="primary">
                  {{ t('mobile_login_history.current') }}
                </van-tag>
                <van-tag v-else-if="record.trust === 'verified'" type="success">
                  {{ t('mobile_login_history.verified') }}
                </van-tag>
                <van-tag v-else-if="record.trust === 'unverified'" type="warning">
                  {{ t('mobile_login_history.unverified') }}
                </van-tag>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_login_history.security_tips') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_login_history.security_tips_title')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="#1989fa" />
                </div>
              </template>
              <template #label>
                <div class="text-12px text-gray-500 mt-4px">
                  {{ t('mobile_login_history.security_tips_desc') }}
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { matrixSettingsService, type LoginHistory } from '@/services/matrix/MatrixSettingsService'
import matrixAccountService from '@/services/matrix/MatrixAccountService'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LoginHistory')

const { t } = useI18n()

interface LoginHistoryWithTrust extends LoginHistory {
  trust: 'verified' | 'unverified' | 'unknown'
}

const loginHistory = ref<LoginHistoryWithTrust[]>([])
const loading = ref(false)
const currentDeviceId = ref<string>('')

onMounted(async () => {
  await loadLoginHistory()
})

async function loadLoginHistory() {
  loading.value = true
  try {
    currentDeviceId.value = matrixAccountService.getCurrentDeviceId() || ''

    const history = await matrixSettingsService.getLoginHistory()

    const historyWithTrust = await Promise.all(
      history.map(async (record) => {
        const trust = await matrixSettingsService.getDeviceTrust(record.deviceId)
        return { ...record, trust }
      })
    )

    loginHistory.value = historyWithTrust
  } catch (error) {
    logger.error('加载登录历史失败:', error)
  } finally {
    loading.value = false
  }
}

function isCurrentDevice(deviceId: string): boolean {
  return deviceId === currentDeviceId.value
}

function getDeviceIcon(userAgent: string | null): string {
  const ua = userAgent?.toLowerCase() || ''
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mdi:cellphone'
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'mdi:tablet'
  }
  return 'mdi:laptop'
}

function formatLabel(record: LoginHistory): string {
  const parts: string[] = []

  if (record.ip) {
    parts.push(record.ip)
  }

  if (record.timestamp) {
    const date = new Date(record.timestamp)
    parts.push(date.toLocaleString())
  }

  return parts.join(' · ') || t('mobile_login_history.no_info')
}
</script>

<style scoped></style>
