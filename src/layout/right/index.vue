<template>
  <!-- 主容器维持 600px 的最小宽度，确保聊天侧边信息不过度挤压 -->
  <main data-tauri-drag-region class="flex-1 bg-[--right-bg-color] flex flex-col min-h-0 min-w-600px">
    <div
      :style="{ background: shouldShowChat ? 'var(--right-theme-bg-color)' : '' }"
      data-tauri-drag-region
      class="flex-1 flex flex-col min-h-0">
      <ActionBar :current-label="appWindow.label" />

      <!-- 需要判断当前路由是否是信息详情界面 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <ChatBox v-if="shouldShowChat" />

        <Details :content="detailsContent" v-else-if="detailsShow && isDetails && detailsContent?.type !== 'apply'" />

        <!-- 好友申请列表 -->
        <ApplyList
          v-else-if="detailsContent && isDetails && detailsContent.type === 'apply'"
          :type="detailsContent.applyType" />

        <!-- 聊天界面背景图标 -->
        <div
          v-else
          class="flex-center size-full select-none flex-col gap-16px text-[var(--text-xs)] color-[--hula-text-tertiary] bg-[--hula-surface-panel]">
          <n-empty :description="t('home.chat_sidebar.empty.no_chat_selected', '未选择会话')" size="huge">
            <template #icon>
              <svg class="size-60px opacity-50 color-[--hula-text-quaternary]">
                <use href="#chat"></use>
              </svg>
            </template>
            <template #extra>
              <n-text depth="3" class="text-[var(--text-xs)] mt-8px inline-block">
                {{ t('home.chat_sidebar.empty.select_to_start', '选择一个会话或发起新聊天') }}
              </n-text>
            </template>
          </n-empty>
        </div>
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { MittEnum, ThemeEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import type { DetailsContent } from '@/services/types'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const settingStore = useSettingStore()
const globalStore = useGlobalStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const detailsShow = ref(false)
const detailsContent = ref<DetailsContent>()
const imgTheme = ref<ThemeEnum>(settingStore.themeContent)
const prefers = matchMedia('(prefers-color-scheme: dark)')
const isChatRoute = computed(() => router.currentRoute.value.path.includes('/message'))
// 只要路由在消息页且选中了会话（即便会话详情尚未同步），就展示 ChatBox
const shouldShowChat = computed(() => isChatRoute.value && !!currentSessionRoomId.value)
const isDetails = computed(() => {
  return router.currentRoute.value.path.includes('/friendsList')
})

/** 跟随系统主题模式切换主题 */
const followOS = () => {
  imgTheme.value = prefers.matches ? ThemeEnum.DARK : ThemeEnum.LIGHT
}

watchEffect(() => {
  if (settingStore.themePattern === ThemeEnum.OS) {
    followOS()
    prefers.addEventListener('change', followOS)
  } else {
    imgTheme.value = settingStore.themeContent || ThemeEnum.LIGHT
    prefers.removeEventListener('change', followOS)
  }
})

onMounted(() => {
  // 好友详情页面通过 mitt 接收主体传来的选中信息
  if (isDetails) {
    useMitt.on(MittEnum.APPLY_SHOW, (event: { context: DetailsContent }) => {
      detailsContent.value = event.context
    })
    useMitt.on(MittEnum.DETAILS_SHOW, (event: { context: DetailsContent; detailsShow: boolean }) => {
      detailsContent.value = event.context
      detailsShow.value = event.detailsShow
    })
  }
})
</script>
