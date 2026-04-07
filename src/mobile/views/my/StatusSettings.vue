<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_status.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_status.subtitle') }}</div>

          <van-cell-group inset>
            <van-cell
              v-for="status in statusOptions"
              :key="status.id"
              :title="status.label"
              is-link
              @click="handleStatusChange(status.id)">
              <template #icon>
                <div
                  class="w-24px h-24px rounded-full mr-12px flex items-center justify-center"
                  :style="{ backgroundColor: status.color }">
                  <Icon :icon="status.icon" :width="14" color="#fff" />
                </div>
              </template>
              <template #right-icon>
                <van-icon v-if="currentStatusId === status.id" name="success" color="#1989fa" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px">
            <van-cell-group inset>
              <van-field
                v-model="statusMessage"
                :label="t('mobile_status.status_message')"
                :placeholder="t('mobile_status.status_message_placeholder')"
                autosize
                type="textarea"
                rows="1"
                show-word-limit
                maxlength="100" />
            </van-cell-group>
          </div>

          <div class="mt-16px px-16px">
            <van-button type="primary" block :loading="loading" @click="handleSave">
              {{ t('mobile_status.save') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { useUserStatusStore } from '@/stores/userStatus'
import { matrixAccountService } from '@/services/matrix'
import { useI18n } from 'vue-i18n'

const logger = createLogger('StatusSettings')

const { t } = useI18n()
const router = useRouter()
const userStatusStore = useUserStatusStore()

const currentStatusId = ref(userStatusStore.stateId || 'online')
const statusMessage = ref('')
const loading = ref(false)

const statusOptions = [
  { id: 'online', label: t('mobile_status.status.online'), icon: 'mdi:circle', color: '#52c41a' },
  { id: 'away', label: t('mobile_status.status.away'), icon: 'mdi:circle', color: '#faad14' },
  { id: 'busy', label: t('mobile_status.status.busy'), icon: 'mdi:circle', color: '#ff4d4f' },
  { id: 'offline', label: t('mobile_status.status.offline'), icon: 'mdi:circle-outline', color: '#999' }
]

function handleStatusChange(statusId: string) {
  currentStatusId.value = statusId
}

async function handleSave() {
  loading.value = true
  try {
    const presenceMap: Record<string, 'online' | 'offline' | 'unavailable'> = {
      online: 'online',
      away: 'unavailable',
      busy: 'unavailable',
      offline: 'offline'
    }

    await matrixAccountService.setPresence(
      presenceMap[currentStatusId.value] || 'online',
      statusMessage.value || undefined
    )

    userStatusStore.stateId = currentStatusId.value
    showToast({
      type: 'success',
      message: t('mobile_status.save_success')
    })
    router.back()
  } catch (error) {
    logger.error('设置状态失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_status.save_failed')
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>
