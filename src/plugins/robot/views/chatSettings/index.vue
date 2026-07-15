<template>
  <div
    class="flex border-b-(1px solid [--hula-border-default]) truncate p-[14px_20px] justify-between items-center gap-50px">
    <n-flex :size="10" vertical class="truncate">
      <p class="text-(22px [--hula-text-primary]) truncate font-500">{{ t('ai_assistant.robot.settings') }}</p>
      <p class="text-(14px [--hula-text-tertiary])">{{ t('ai_assistant.robot.all_settings') }}</p>
    </n-flex>

    <n-flex class="min-w-fit">
      <div @click="handleClose" class="right-btn">
        <svg><use href="#close"></use></svg>
      </div>
    </n-flex>
  </div>

  <!-- 设置的主体内容  -->
  <n-scrollbar
    :class="{ 'shadow-inner': settingStore.pageShadowEnabled }"
    style="max-height: calc(100vh / var(--page-scale, 1) - 104px)">
    <n-flex vertical :size="20" class="p-[20px_0]">
      <div v-for="(key, index) in content" :key="index" class="flex flex-1 p-[0_20px]">
        <n-flex
          vertical
          class="w-full h-fit bg-[--bg-setting-item] border-(solid 1px [--hula-border-default]) custom-shadow rounded-8px p-10px">
          <n-flex vertical justify="center" v-for="(item, index) in key" :key="index">
            <n-flex justify="space-between" :size="20" align="center" class="p-8px">
              <n-flex vertical :size="4">
                <p class="text-(15px [--hula-text-primary]) font-500">{{ item.title }}</p>
                <p v-if="item.description" class="text-(12px [--hula-text-tertiary])">{{ item.description }}</p>
              </n-flex>

              <component :is="item.features" />
            </n-flex>

            <div v-if="index !== key.length - 1" class="h-1px bg-[--hula-border-default]"></div>
          </n-flex>
        </n-flex>
      </div>
    </n-flex>
  </n-scrollbar>
</template>
<script setup lang="tsx">
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import router from '@/router'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { content } from './config.tsx'

const { t } = useI18n()
const settingStore = useSettingStore()
const handleClose = () => {
  router.push('/chat').then(() => {
    nextTick(() => {
      useMitt.emit('return-chat')
    })
  })
}
</script>
<style scoped lang="scss">
.right-btn {
  @apply size-fit border-(1px solid [--hula-border-default]) cursor-pointer bg-[--chat-bt-color] color-[--hula-text-primary] rounded-8px custom-shadow p-[10px_11px];
  svg {
    @apply size-18px;
  }
}
</style>
