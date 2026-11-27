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

          <MobileAsyncState
            v-if="isIgnoredListEmpty"
            state="empty"
            :empty-text="t('mobile_ignored_users.empty')"
            min-height="240px" />

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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import { useRefreshOnReactivate } from '@/mobile/composables/useRefreshOnReactivate'
import { matrixAccountService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileIgnoredUsers')

const { t } = useI18n()

const loading = ref(false)
const ignoredUsers = ref<string[]>([])

/** 黑名单为空：交给 MobileAsyncState 统一渲染 */
const isIgnoredListEmpty = computed(() => ignoredUsers.value.length === 0)

async function loadIgnoredUsers(options: { silent?: boolean } = {}): Promise<void> {
  const silent = options.silent === true
  if (!silent) {
    loading.value = true
  }
  try {
    ignoredUsers.value = await matrixAccountService.getIgnoredUsers()
  } catch (error) {
    logger.error('Failed to load ignored users', error)
    // 静默刷新失败不打扰用户：列表保持上次的值，下次激活会再试
    if (!silent) {
      showToast({ type: 'fail', message: t('mobile_ignored_users.load_failed') })
    }
  } finally {
    if (!silent) {
      loading.value = false
    }
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

// 首次挂载加载；切 Tab 回来（keep-alive activate）时静默刷新
useRefreshOnReactivate(loadIgnoredUsers, () => loadIgnoredUsers({ silent: true }))
</script>
