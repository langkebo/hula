<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_ignored_users.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_ignored_users.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <p class="text-14px text-[--tjg-text-secondary] m-0">{{ t('mobile_ignored_users.intro') }}</p>

          <van-empty v-if="ignoredUsers.length === 0" :description="t('mobile_ignored_users.empty')" image="search" />

          <van-cell-group v-else inset>
            <van-cell v-for="userId in ignoredUsers" :key="userId" :title="userId" :label="userId">
              <template #right-icon>
                <van-button
                  size="small"
                  :aria-label="t('mobile_ignored_users.unignore')"
                  @click="handleUnignore(userId)">
                  {{ t('mobile_ignored_users.unignore') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixAccountService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileIgnoredUsers')

const { t } = useI18n()

const loading = ref(false)
const ignoredUsers = ref<string[]>([])

async function loadIgnoredUsers(): Promise<void> {
  loading.value = true
  try {
    ignoredUsers.value = await matrixAccountService.getIgnoredUsers()
  } catch (error) {
    logger.error('Failed to load ignored users', error)
    showToast({ type: 'fail', message: t('mobile_ignored_users.load_failed') })
  } finally {
    loading.value = false
  }
}

/**
 * 取消忽略某个用户。
 *
 * 忽略列表是整表覆盖写入（`m.ignored_user_list`），因此先做二次确认，
 * 失败时保留本地列表，避免界面与服务器状态不一致。
 */
async function handleUnignore(userId: string): Promise<void> {
  try {
    await showConfirmDialog({
      title: t('mobile_ignored_users.unignore'),
      message: t('mobile_ignored_users.unignore_confirm', { userId }),
      confirmButtonText: t('mobile_ignored_users.unignore'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }

  const next = ignoredUsers.value.filter((id) => id !== userId)
  try {
    await matrixAccountService.setIgnoredUsers(next)
    ignoredUsers.value = next
    showToast(t('mobile_ignored_users.unignore_success'))
  } catch (error) {
    logger.error('Failed to unignore user', error)
    showToast({ type: 'fail', message: t('mobile_ignored_users.unignore_failed') })
  }
}

onMounted(async () => {
  await loadIgnoredUsers()
})
</script>
