<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_status.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-8px">{{ t('mobile_status.subtitle') }}</div>

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
                  <Icon :icon="status.icon" :width="14" color="var(--tjg-text-inverse)" />
                </div>
              </template>
              <template #right-icon>
                <van-icon v-if="currentStatusId === status.id" name="success" color="var(--tjg-color-info-500)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-12px text-[var(--tjg-text-tertiary)] px-4px">
            {{ t('mobile_status.away_busy_limited') }}
          </div>

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
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { OnlineEnum } from '@/enums'
import { matrixPresenceService, type PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { createLogger } from '@/utils/Logger'
import { isBusyUserStateTitle } from '@/utils/userStatus'

const logger = createLogger('StatusSettings')

const { t } = useI18n()
const router = useRouter()
const userStatusStore = useUserStatusStore()

const currentStatusId = ref(userStatusStore.stateId || 'online')
const statusMessage = ref('')
/** 进入页面时的服务端状态文案：保存时据此判断用户是否真的改过文案 */
const initialStatusMessage = ref('')
const loading = ref(false)

const statusOptions = [
  { id: 'online', label: t('mobile_status.status.online'), icon: 'mdi:circle', color: 'var(--tjg-color-success-500)' },
  { id: 'away', label: t('mobile_status.status.away'), icon: 'mdi:circle', color: 'var(--tjg-color-warning-500)' },
  { id: 'busy', label: t('mobile_status.status.busy'), icon: 'mdi:circle', color: 'var(--tjg-color-danger-500)' },
  {
    id: 'offline',
    label: t('mobile_status.status.offline'),
    icon: 'mdi:circle-outline',
    color: 'var(--tjg-text-quaternary)'
  }
]

function handleStatusChange(statusId: string) {
  currentStatusId.value = statusId
}

/**
 * presence → 页面状态。
 *
 * Matrix 协议只有 online/offline/unavailable 三态，away 与 busy 都上报为 unavailable，
 * 因此 unavailable 时沿用本地已保存状态标题的语义（可判定为忙碌则选 busy），其余按离开处理。
 */
function resolveStatusId(presence: PresenceState): string {
  if (presence === 'online') return 'online'
  if (presence === 'offline') return 'offline'
  const storedTitle = userStatusStore.currentState?.title
  if (storedTitle && isBusyUserStateTitle(storedTitle)) return 'busy'
  return currentStatusId.value === 'busy' ? 'busy' : 'away'
}

/** 进入页面回填服务端真实 presence 与状态文案，避免把「页面初值」当成用户输入 */
async function loadCurrentStatus(): Promise<void> {
  try {
    const info = await matrixPresenceService.getCurrentPresence()
    initialStatusMessage.value = info.status_msg ?? ''
    statusMessage.value = initialStatusMessage.value
    currentStatusId.value = resolveStatusId(info.presence)
  } catch (error) {
    // 回填失败时保持空文案：保存按「未修改」透传 undefined，不会清空服务端已有文案
    logger.warn('Failed to load current presence', error)
  }
}

onMounted(() => {
  void loadCurrentStatus()
})

async function handleSave() {
  loading.value = true
  try {
    const presenceMap: Record<string, 'online' | 'offline' | 'unavailable'> = {
      online: 'online',
      away: 'unavailable',
      busy: 'unavailable',
      offline: 'offline'
    }

    const targetPresence = presenceMap[currentStatusId.value] || 'online'
    // 只在用户真的改过文案时覆盖；未改动传 undefined，服务层会省略 status_msg 而不是清空
    const messageChanged = statusMessage.value !== initialStatusMessage.value
    // 与桌面同一唯一写入点：门控与记账都在 matrixPresenceService.setPresence 内完成，
    // 这里只传意图，并用返回的生效值把本地 activeStatus 同步为离线（hidesOnline 同语义）。
    const effective = await matrixPresenceService.setPresence(
      targetPresence,
      messageChanged ? statusMessage.value : undefined
    )
    const hidesOnline = effective !== targetPresence

    userStatusStore.stateId = currentStatusId.value

    const userStore = useUserStore()
    if (hidesOnline && userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.OFFLINE
    }

    showToast({
      type: 'success',
      message: t('mobile_status.save_success')
    })
    router.back()
  } catch (error) {
    logger.error('Failed to update status', error)
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
