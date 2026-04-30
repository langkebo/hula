<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_chat.search')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="p-16px">
          <van-search v-model="searchQuery" :placeholder="t('mobile_chat.search_placeholder')" shape="round" />

          <div class="flex flex-col items-center mt-20px">
            <div class="mb-16px text-14px text-gray-400">{{ t('mobile_chat.quick_search') }}</div>
            <div class="grid grid-cols-3 gap-12px w-full max-w-300px">
              <van-button plain type="primary" size="small" icon="friends-o">{{ t('mobile_chat.members') }}</van-button>
              <van-button plain type="primary" size="small" icon="calendar-o">{{ t('mobile_chat.date') }}</van-button>
              <van-button
                plain
                type="primary"
                size="small"
                icon="photo-o"
                @click="router.push({ name: 'mobileMediaViewer' })">
                {{ t('mobile_chat.media') }}
              </van-button>
              <van-button plain type="primary" size="small" icon="description">{{ t('mobile_chat.files') }}</van-button>
              <van-button plain type="primary" size="small" icon="link-o">{{ t('mobile_chat.links') }}</van-button>
              <van-button plain type="primary" size="small" icon="music-o">{{ t('mobile_chat.audio') }}</van-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'

const router = useRouter()
const { t } = useI18n()
const searchQuery = ref('')
</script>
