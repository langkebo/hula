<template>
  <div class="h-full w-full bg-[--center-bg-color] text-[--text-color]">
    <ActionBar class="absolute right-0 w-full z-999" :shrink="false" :current-label="currentLabel" />

    <div class="absolute-x-center h-fit pt-6px text-(13px [--text-color])" data-tauri-drag-region>收藏</div>

    <div class="h-full box-border flex flex-col p-[42px_20px_20px] gap-16px">
      <div class="rounded-16px bg-[--bg-edit] px-18px py-16px" data-tauri-drag-region>
        <div class="text-18px font-600">收藏内容</div>
        <div class="mt-6px text-13px text-[--text-color] op-70">
          共 {{ totalCount }} 项，消息 {{ favoriteStats.messages }} 条，图片 {{ favoriteStats.images }} 张，链接
          {{ favoriteStats.links }} 个
        </div>
      </div>

      <div class="min-h-0 flex-1 rounded-16px bg-[--bg-edit] p-16px">
        <n-tabs v-model:value="activeTab" type="segment" animated>
          <n-tab-pane name="messages" :tab="`消息 (${favoriteStats.messages})`">
            <div v-if="favoriteMessages.length" class="flex flex-col gap-12px">
              <div
                v-for="item in favoriteMessages"
                :key="item.id"
                class="rounded-14px border border-[--line-color] bg-[--center-bg-color] px-14px py-12px">
                <div class="flex items-start justify-between gap-12px">
                  <div class="min-w-0">
                    <div class="text-14px font-600">{{ item.conversationName }}</div>
                    <div class="mt-4px text-12px op-70">{{ item.senderName }} · {{ formatTime(item.timestamp) }}</div>
                  </div>
                  <n-button text type="primary" @click="removeMessage(item.id)">取消收藏</n-button>
                </div>
                <div class="mt-10px whitespace-pre-wrap break-words text-13px leading-20px">{{ item.content }}</div>
              </div>
            </div>
            <n-empty v-else description="还没有收藏的消息" class="h-full justify-center" />
          </n-tab-pane>

          <n-tab-pane name="images" :tab="`图片 (${favoriteStats.images})`">
            <div v-if="favoriteImages.length" class="grid grid-cols-2 gap-12px">
              <div
                v-for="item in favoriteImages"
                :key="item.id"
                class="rounded-14px border border-[--line-color] bg-[--center-bg-color] p-12px">
                <img class="h-180px w-full rounded-10px object-cover" :src="item.imageUrl" :alt="item.fileName" />
                <div class="mt-10px text-14px font-600">{{ item.fileName }}</div>
                <div class="mt-4px text-12px op-70">{{ item.senderName }} · {{ formatTime(item.timestamp) }}</div>
                <div class="mt-8px flex justify-end">
                  <n-button text type="primary" @click="removeImage(item.id)">取消收藏</n-button>
                </div>
              </div>
            </div>
            <n-empty v-else description="还没有收藏的图片" class="h-full justify-center" />
          </n-tab-pane>

          <n-tab-pane name="links" :tab="`链接 (${favoriteStats.links})`">
            <div v-if="favoriteLinks.length" class="flex flex-col gap-12px">
              <div
                v-for="item in favoriteLinks"
                :key="item.id"
                class="rounded-14px border border-[--line-color] bg-[--center-bg-color] px-14px py-12px">
                <div class="flex items-start justify-between gap-12px">
                  <div class="min-w-0">
                    <div class="text-14px font-600">{{ item.title }}</div>
                    <button
                      class="mt-4px cursor-pointer border-none bg-transparent p-0 text-12px text-[#4f7cff]"
                      @click="openLink(item.url)">
                      {{ item.url }}
                    </button>
                  </div>
                  <n-button text type="primary" @click="removeLink(item.id)">取消收藏</n-button>
                </div>
                <div class="mt-10px text-13px leading-20px op-80">{{ item.summary }}</div>
              </div>
            </div>
            <n-empty v-else description="还没有收藏的链接" class="h-full justify-center" />
          </n-tab-pane>
        </n-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useFavorites } from '@/composables/useFavorites'

const currentLabel = WebviewWindow.getCurrent().label
const {
  activeTab,
  favoriteMessages,
  favoriteImages,
  favoriteLinks,
  favoriteStats,
  totalCount,
  formatTime,
  removeMessageFavorite,
  removeImageFavorite,
  removeLinkFavorite
} = useFavorites()

const removeMessage = (id: string) => {
  removeMessageFavorite(id)
  window.$message.success('已取消收藏')
}

const removeImage = (id: string) => {
  removeImageFavorite(id)
  window.$message.success('已取消收藏')
}

const removeLink = (id: string) => {
  removeLinkFavorite(id)
  window.$message.success('已取消收藏')
}

const openLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>
