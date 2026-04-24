<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_favorites.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <van-tabs v-model:active="activeTab" sticky>
            <van-tab :title="t('mobile_favorites.messages')">
              <div v-if="favoriteMessages.length === 0" class="flex flex-col items-center justify-center py-60px">
                <Icon icon="mdi:message-star-outline" :width="48" color="#d9d9d9" />
                <div class="text-14px text-gray-400 mt-12px">{{ t('mobile_favorites.empty_messages') }}</div>
              </div>
              <div v-else class="flex flex-col gap-12px pt-12px">
                <div
                  v-for="msg in favoriteMessages"
                  :key="msg.id"
                  class="bg-white rounded-12px p-12px border border-gray-100">
                  <div class="flex items-center gap-8px mb-8px">
                    <van-image round width="32" height="32" :src="msg.avatar" />
                    <div class="flex-1">
                      <div class="text-14px font-medium">{{ msg.username }}</div>
                      <div class="text-12px text-gray-400">{{ formatTime(msg.time) }}</div>
                    </div>
                    <van-icon name="star" color="#fa8c16" @click="removeFavorite(msg.id)" />
                  </div>
                  <div class="text-14px text-gray-700">{{ msg.content }}</div>
                </div>
              </div>
            </van-tab>

            <van-tab :title="t('mobile_favorites.images')">
              <div v-if="favoriteImages.length === 0" class="flex flex-col items-center justify-center py-60px">
                <Icon icon="mdi:image-outline" :width="48" color="#d9d9d9" />
                <div class="text-14px text-gray-400 mt-12px">{{ t('mobile_favorites.empty_images') }}</div>
              </div>
              <div v-else class="grid grid-cols-3 gap-8px pt-12px">
                <div
                  v-for="img in favoriteImages"
                  :key="img.id"
                  class="aspect-square rounded-8px overflow-hidden relative">
                  <img :src="img.url" class="w-full h-full object-cover" />
                  <div class="absolute top-4px right-4px">
                    <van-icon name="star" color="#fa8c16" size="16" @click="removeImageFavorite(img.id)" />
                  </div>
                </div>
              </div>
            </van-tab>

            <van-tab :title="t('mobile_favorites.links')">
              <div v-if="favoriteLinks.length === 0" class="flex flex-col items-center justify-center py-60px">
                <Icon icon="mdi:link-variant" :width="48" color="#d9d9d9" />
                <div class="text-14px text-gray-400 mt-12px">{{ t('mobile_favorites.empty_links') }}</div>
              </div>
              <div v-else class="flex flex-col gap-12px pt-12px">
                <div
                  v-for="link in favoriteLinks"
                  :key="link.id"
                  class="bg-white rounded-12px p-12px border border-gray-100"
                  @click="openLink(link.url)">
                  <div class="flex items-center gap-8px">
                    <Icon icon="mdi:link-variant" :width="20" color="#1989fa" />
                    <div class="flex-1 truncate text-14px text-blue-500">{{ link.title }}</div>
                    <van-icon name="star" color="#fa8c16" @click.stop="removeLinkFavorite(link.id)" />
                  </div>
                  <div class="text-12px text-gray-400 mt-4px truncate">{{ link.url }}</div>
                </div>
              </div>
            </van-tab>
          </van-tabs>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const activeTab = ref(0)

const favoriteMessages = ref([
  { id: '1', username: '张三', avatar: '', time: Date.now() - 3600000, content: '这是一条收藏的消息示例' }
])

const favoriteImages = ref([
  { id: '1', url: 'https://picsum.photos/200/200?random=1' },
  { id: '2', url: 'https://picsum.photos/200/200?random=2' }
])

const favoriteLinks = ref([{ id: '1', title: 'Matrix 协议官网', url: 'https://matrix.org' }])

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5)
}

function removeFavorite(id: string) {
  favoriteMessages.value = favoriteMessages.value.filter((m) => m.id !== id)
  showToast(t('mobile_favorites.removed'))
}

function removeImageFavorite(id: string) {
  favoriteImages.value = favoriteImages.value.filter((i) => i.id !== id)
  showToast(t('mobile_favorites.removed'))
}

function removeLinkFavorite(id: string) {
  favoriteLinks.value = favoriteLinks.value.filter((l) => l.id !== id)
  showToast(t('mobile_favorites.removed'))
}

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>

<style scoped></style>
