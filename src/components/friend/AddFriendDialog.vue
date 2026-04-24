<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('friend.add.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="add-friend-dialog"
    style="width: 420px; max-width: 90vw">
    <n-flex vertical :size="16">
      <n-input
        v-model:value="searchValue"
        :placeholder="t('friend.add.placeholder')"
        size="large"
        clearable
        @keydown.enter="handleSearch">
        <template #prefix>
          <n-icon>
            <svg class="icon"><use href="#search" /></svg>
          </n-icon>
        </template>
      </n-input>

      <n-spin :show="loading">
        <div v-if="searchResult" class="search-result">
          <n-flex align="center" :size="12">
            <n-avatar
              :size="56"
              :src="AvatarUtils.getAvatarUrl(searchResult.avatarUrl)"
              :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              round />
            <n-flex vertical :size="4" class="flex-1">
              <span class="text-16px font-medium">{{ searchResult.displayName || searchResult.userId }}</span>
              <span class="text-12px text-gray-500">{{ searchResult.userId }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 12px 0" />

          <n-flex vertical :size="8">
            <span class="text-12px text-gray-500">{{ t('friend.add.message_label') }}</span>
            <n-input
              v-model:value="requestMessage"
              type="textarea"
              :placeholder="t('friend.add.message_placeholder')"
              :maxlength="200"
              :autosize="{ minRows: 2, maxRows: 4 }"
              show-count />
          </n-flex>

          <n-flex justify="end" :size="12" class="mt-16px">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" :loading="sending" @click="handleSendRequest">
              {{ t('friend.add.send') }}
            </n-button>
          </n-flex>
        </div>

        <n-empty v-else-if="hasSearched" :description="t('friend.add.not_found')" />

        <div v-else class="search-hint">
          <n-icon size="48" color="#ccc">
            <svg><use href="#search" /></svg>
          </n-icon>
          <span class="text-14px text-gray-400">{{ t('friend.add.hint') }}</span>
        </div>
      </n-spin>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useContactStore, type MatrixContact } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)

const visible = defineModel<boolean>('show', { default: false })
const searchValue = ref('')
const searchResult = ref<MatrixContact | null>(null)
const requestMessage = ref('')
const loading = ref(false)
const sending = ref(false)
const hasSearched = ref(false)

const handleSearch = async () => {
  const userId = searchValue.value.trim()
  if (!userId) return

  loading.value = true
  hasSearched.value = true

  try {
    const profile = await contactStore.getUserProfile(userId)
    searchResult.value = profile

    if (await contactStore.isFriend(userId)) {
      window.$message.info(t('friend.add.already_friend'))
    }
  } catch (err) {
    window.$message.error(t('friend.add.search_error'))
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSendRequest = async () => {
  if (!searchResult.value) return

  sending.value = true
  try {
    const success = await contactStore.sendFriendRequest(searchResult.value.userId, requestMessage.value)
    if (success) {
      window.$message.success(t('friend.add.success'))
      visible.value = false
      resetForm()
    }
  } catch (err) {
    window.$message.error(t('friend.add.error'))
  } finally {
    sending.value = false
  }
}

const handleCancel = () => {
  visible.value = false
  resetForm()
}

const resetForm = () => {
  searchValue.value = ''
  searchResult.value = null
  requestMessage.value = ''
  hasSearched.value = false
}

watch(visible, (val) => {
  if (!val) {
    resetForm()
  }
})
</script>

<style scoped lang="scss">
.add-friend-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px 20px;
  }
}

.search-result {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
}

.search-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 0;
}
</style>
