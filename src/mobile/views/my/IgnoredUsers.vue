<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_ignored_users.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_ignored_users.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_ignored_users.subtitle') }}</div>

          <div v-if="ignoredUsers.length === 0" class="flex flex-col items-center justify-center py-60px">
            <Icon icon="mdi:account-check" :width="48" color="#999" />
            <div class="text-14px text-gray-400 mt-16px">{{ t('mobile_ignored_users.empty') }}</div>
          </div>

          <van-cell-group v-else inset>
            <van-cell
              v-for="userId in ignoredUsers"
              :key="userId"
              :title="getDisplayName(userId)"
              :label="userId">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center overflow-hidden">
                  <img
                    v-if="avatars[userId]"
                    :src="avatars[userId]"
                    class="w-full h-full object-cover"
                    @error="handleAvatarError(userId)" />
                  <Icon v-else icon="mdi:account" :width="20" color="#999" />
                </div>
              </template>
              <template #right-icon>
                <van-button
                  size="small"
                  type="primary"
                  plain
                  @click.stop="handleUnignore(userId)">
                  {{ t('mobile_ignored_users.unblock') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_ignored_users.add_section') }}</div>

          <van-cell-group inset>
            <van-field
              v-model="newUserId"
              :placeholder="t('mobile_ignored_users.add_placeholder')"
              :label="t('mobile_ignored_users.user_id')"
              clearable>
              <template #button>
                <van-button
                  size="small"
                  type="primary"
                  :disabled="!newUserId"
                  @click="handleAddIgnore">
                  {{ t('mobile_ignored_users.add') }}
                </van-button>
              </template>
            </van-field>
          </van-cell-group>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { matrixSettingsService } from '@/services/matrix/MatrixSettingsService'
import matrixProfileService from '@/services/matrix/MatrixProfileService'
import matrixMediaService from '@/services/matrix/MatrixMediaService'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('IgnoredUsers')

const { t } = useI18n()

const ignoredUsers = ref<string[]>([])
const loading = ref(false)
const newUserId = ref('')
const avatars = reactive<Record<string, string>>({})

onMounted(async () => {
  await loadIgnoredUsers()
})

async function loadIgnoredUsers() {
  loading.value = true
  try {
    ignoredUsers.value = await matrixSettingsService.getIgnoredUsers()
    await loadAvatars()
  } catch (error) {
    logger.error('加载屏蔽用户列表失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_ignored_users.load_failed')
    })
  } finally {
    loading.value = false
  }
}

async function loadAvatars() {
  for (const userId of ignoredUsers.value) {
    try {
      const profile = await matrixProfileService.getProfile(userId)
      if (profile?.avatarUrl) {
        const httpUrl = matrixMediaService.mxcUrlToHttp(profile.avatarUrl, 40, 40, 'crop')
        if (httpUrl) {
          avatars[userId] = httpUrl
        }
      }
    } catch (error) {
      logger.error(`Failed to load avatar for ${userId}:`, error)
    }
  }
}

function getDisplayName(userId: string): string {
  const profile = matrixProfileService.getProfileFromCache(userId)
  return profile?.displayname || userId.split(':')[0].substring(1)
}

function handleAvatarError(userId: string) {
  delete avatars[userId]
}

async function handleUnignore(userId: string) {
  try {
    const success = await matrixSettingsService.unignoreUser(userId)
    if (success) {
      ignoredUsers.value = ignoredUsers.value.filter((id) => id !== userId)
      delete avatars[userId]
      showToast({
        type: 'success',
        message: t('mobile_ignored_users.unblock_success')
      })
    }
  } catch (error) {
    logger.error('取消屏蔽失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_ignored_users.unblock_failed')
    })
  }
}

async function handleAddIgnore() {
  if (!newUserId.value) return

  let userId = newUserId.value.trim()
  if (!userId.startsWith('@')) {
    const domain = matrixClientService.getDomain() || 'localhost'
    userId = `@${userId}:${domain}`
  }

  if (ignoredUsers.value.includes(userId)) {
    showToast({
      type: 'fail',
      message: t('mobile_ignored_users.already_blocked')
    })
    return
  }

  try {
    const success = await matrixSettingsService.ignoreUser(userId)
    if (success) {
      ignoredUsers.value.push(userId)
      newUserId.value = ''
      showToast({
        type: 'success',
        message: t('mobile_ignored_users.block_success')
      })
    }
  } catch (error) {
    logger.error('添加屏蔽失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_ignored_users.block_failed')
    })
  }
}
</script>

<style scoped></style>
