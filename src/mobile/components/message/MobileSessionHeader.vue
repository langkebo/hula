<template>
  <div @click="emit('click')" class="flex items-center gap-6px w-full">
    <img
      class="size-38px rounded-full object-cover"
      :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ? userStore.userInfo.avatar : '/logoD.png')"
      alt="用户头像"
      @error="($event.target as HTMLImageElement).src = '/logo.png'" />

    <div class="flex flex-col justify-center gap-6px">
      <p class="session-name text-(16px [--tjg-text-primary])">
        {{ userStore.userInfo?.name ? userStore.userInfo.name : t('mobile_home.noname') }}
      </p>
      <p class="text-(10px [--tjg-text-primary])">
        {{ t('mobile_home.china') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineOptions({ name: 'MobileSessionHeader' })

const emit = defineEmits<(e: 'click') => void>()

const { t } = useI18n()
const userStore = useUserStore()
</script>

<style scoped lang="scss">
/* 会话名加粗（原为模板内联 style）。原先的内联 font-family 从未生效——
   全局 `* { font-family: var(--font-family) !important }`（variable.scss）优先级更高。 */
.session-name {
  font-weight: var(--tjg-font-weight-bold);
}
</style>
