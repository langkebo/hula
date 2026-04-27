<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('dm.create.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="true"
    class="create-dm-dialog"
    style="width: 420px; max-width: 90vw">
    <n-flex vertical :size="16">
      <n-input
        v-model:value="searchValue"
        :placeholder="t('dm.create.placeholder')"
        size="large"
        clearable
        @keydown.enter="handleSearch">
        <template #prefix>
          <n-icon>
            <svg class="icon"><use href="#search" /></svg>
          </n-icon>
        </template>
      </n-input>

      <n-checkbox v-model:checked="encrypted">
        <n-flex align="center" :size="4">
          <n-icon size="16">
            <svg><use href="#lock" /></svg>
          </n-icon>
          <span>{{ t('dm.create.encrypted') }}</span>
        </n-flex>
      </n-checkbox>

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
              <span class="text-12px text-gray-500">{{ searchResult.userId }}</span>
            </n-flex>
          </n-flex>

          <n-divider style="margin: 12px 0" />

          <n-flex justify="end" :size="12">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" :loading="creating" @click="handleCreate">
              {{ t('dm.create.action') }}
            </n-button>
          </n-flex>
        </div>

        <n-empty v-else-if="hasSearched" :description="t('dm.create.not_found')" />

        <div v-else class="search-hint">
          <n-icon size="48" color="#ccc">
            <svg><use href="#search" /></svg>
          </n-icon>
          <span class="text-14px text-gray-400">{{ t('dm.create.hint') }}</span>
        </div>
      </n-spin>

      <n-divider style="margin: 0" />

      <n-flex vertical :size="8">
        <span class="text-12px text-gray-500">{{ t('dm.create.recent_contacts') }}</span>
        <n-scrollbar style="max-height: 200px">
          <div v-if="recentContacts.length === 0" class="text-12px text-gray-400">
            {{ t('dm.create.no_recent') }}
          </div>
          <div v-else class="recent-list">
            <div
              v-for="contact in recentContacts"
              :key="contact.userId"
              class="recent-item"
              @click="handleSelectContact(contact)">
              <n-flex align="center" :size="8">
                <n-avatar
                  :size="32"
                  :src="AvatarUtils.getAvatarUrl(contact.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
                <span class="text-14px truncate">{{ contact.displayName || contact.userId }}</span>
              </n-flex>
            </div>
          </div>
        </n-scrollbar>
      </n-flex>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useContactStore, type MatrixContact } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()

const visible = defineModel<boolean>('show', { default: false })
const emit = defineEmits<(e: 'created', roomId: string) => void>()

const searchValue = ref('')
const searchResult = ref<MatrixContact | null>(null)
const encrypted = ref(false)
const loading = ref(false)
const creating = ref(false)
const hasSearched = ref(false)

const recentContacts = computed(() => {
  return contactStore.contactsList.slice(0, 10)
})

const handleSearch = async () => {
  const userId = searchValue.value.trim()
  if (!userId) return

  loading.value = true
  hasSearched.value = true

  try {
    const profile = await contactStore.getUserProfile(userId)
    searchResult.value = profile
  } catch (err) {
    searchResult.value = null
  } finally {
    loading.value = false
  }
}

const handleSelectContact = (contact: MatrixContact) => {
  searchResult.value = contact
  searchValue.value = contact.userId
}

const handleCreate = async () => {
  if (!searchResult.value) return

  creating.value = true
  try {
    const room = await matrixDirectMessageService.getOrCreateDmRoom(searchResult.value.userId, encrypted.value)
    if (room) {
      emit('created', room)
      visible.value = false
      resetForm()
    }
  } catch (err) {
    window.$message.error(t('dm.create.error'))
  } finally {
    creating.value = false
  }
}

const handleCancel = () => {
  visible.value = false
  resetForm()
}

const resetForm = () => {
  searchValue.value = ''
  searchResult.value = null
  encrypted.value = false
  hasSearched.value = false
}

watch(visible, (val) => {
  if (!val) {
    resetForm()
  }
})
</script>

<style scoped lang="scss">
.create-dm-dialog {
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

.search-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 0;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recent-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}
</style>
