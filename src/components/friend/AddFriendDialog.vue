<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('friend.add.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="add-friend-dialog"
    style="width: 460px; max-width: 90vw">
    <n-flex vertical :size="16">
      <n-flex align="center" :size="8">
        <n-input
          v-model:value="searchValue"
          :placeholder="t('friend.add.placeholder')"
          size="large"
          clearable
          class="flex-1"
          @keydown.enter="handleSearch">
          <template #prefix>
            <n-icon>
              <svg class="icon"><use href="#search" /></svg>
            </n-icon>
          </template>
        </n-input>
        <n-select v-model:value="searchMode" :options="searchModeOptions" size="large" style="width: 100px" />
      </n-flex>

      <n-spin :show="loading">
        <div v-if="searchResult" class="search-result">
          <n-flex align="center" :size="12">
            <n-avatar
              :size="56"
              :src="AvatarUtils.getAvatarUrl(searchResult.avatarUrl)"
              :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              round />
            <n-flex vertical :size="4" class="flex-1">
              <span class="text-16px font-medium">{{ searchResult.displayName || searchResult.userId }}</span>
              <span class="text-12px text-[--hula-text-secondary]">{{ searchResult.userId }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 12px 0" />

          <n-flex vertical :size="8">
            <span class="text-12px text-[--hula-text-tertiary]">{{ t('friend.add.message_label') }}</span>
            <n-input
              v-model:value="requestMessage"
              type="textarea"
              :placeholder="t('friend.add.message_placeholder')"
              :maxlength="500"
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

        <div v-else-if="suggestions.length > 0" class="suggestions-section">
          <span class="text-12px text-[--hula-text-tertiary] mb-8px">{{ t('friend.add.suggestions') }}</span>
          <div class="suggestion-list">
            <div
              v-for="suggestion in suggestions"
              :key="suggestion.user_id"
              class="suggestion-item"
              @click="handleSelectSuggestion(suggestion)">
              <n-flex align="center" :size="10">
                <n-avatar
                  :size="36"
                  :src="AvatarUtils.getAvatarUrl(suggestion.avatar_url ?? '')"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <n-flex vertical :size="2" class="flex-1">
                  <span class="text-13px">{{ suggestion.display_name || suggestion.user_id }}</span>
                  <span class="text-11px text-[--hula-text-tertiary]">{{ suggestion.user_id }}</span>
                </n-flex>
                <n-button size="tiny" type="primary" ghost>
                  {{ t('friend.add.send') }}
                </n-button>
              </n-flex>
            </div>
          </div>
        </div>

        <div v-else class="search-hint">
          <n-icon size="48" color="var(--hula-text-tertiary)">
            <svg><use href="#search" /></svg>
          </n-icon>
          <span class="text-14px text-[--hula-text-tertiary]">{{ t('friend.add.hint') }}</span>
        </div>
      </n-spin>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()

const visible = defineModel<boolean>('show', { default: false })
const searchValue = ref('')
const searchMode = ref<'fuzzy' | 'exact'>('fuzzy')
const searchResult = ref<MatrixContact | null>(null)
const requestMessage = ref('')
const loading = ref(false)
const sending = ref(false)
const hasSearched = ref(false)
const suggestions = ref<Array<{ user_id: string; display_name?: string; avatar_url?: string; reason?: string }>>([])

const searchModeOptions = computed(() => [
  { label: t('friend.add.mode_fuzzy'), value: 'fuzzy' },
  { label: t('friend.add.mode_exact'), value: 'exact' }
])

const loadSuggestions = async () => {
  try {
    const result = await matrixFriendService.getFriendSuggestions()
    suggestions.value = result.slice(0, 5)
  } catch {
    suggestions.value = []
  }
}

const handleSearch = async () => {
  const query = searchValue.value.trim()
  if (!query) return

  loading.value = true
  hasSearched.value = true

  try {
    const searchResults = await matrixFriendService.searchFriendsViaApi(query, {
      mode: searchMode.value,
      limit: 1
    })

    if (searchResults.length > 0) {
      const userId = searchResults[0].user_id
      const profile = await contactStore.getUserProfile(userId)
      searchResult.value = profile

      if (await contactStore.isFriend(userId)) {
        window.$message?.info(t('friend.add.already_friend'))
      }
    } else {
      searchResult.value = null
    }
  } catch {
    window.$message?.error(t('friend.add.search_error'))
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSelectSuggestion = async (suggestion: { user_id: string }) => {
  searchValue.value = suggestion.user_id
  loading.value = true
  hasSearched.value = true

  try {
    const profile = await contactStore.getUserProfile(suggestion.user_id)
    searchResult.value = profile

    if (await contactStore.isFriend(suggestion.user_id)) {
      window.$message?.info(t('friend.add.already_friend'))
    }
  } catch {
    window.$message?.error(t('friend.add.search_error'))
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSendRequest = async () => {
  if (!searchResult.value) return

  if (requestMessage.value.length > 500) {
    window.$message?.warning(t('friend.add.message_too_long'))
    return
  }

  sending.value = true
  try {
    const success = await contactStore.sendFriendRequest(searchResult.value.userId, requestMessage.value)
    if (success) {
      window.$message?.success(t('friend.add.success'))
      visible.value = false
      resetForm()
    }
  } catch {
    window.$message?.error(t('friend.add.error'))
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
  if (val) {
    loadSuggestions()
  } else {
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
  background: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
}

.suggestions-section {
  display: flex;
  flex-direction: column;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
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
