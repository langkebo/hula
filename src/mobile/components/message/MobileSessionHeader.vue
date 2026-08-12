<template>
  <div @click="emit('click')" class="flex items-center gap-6px w-full">
    <img
      class="size-38px rounded-full object-cover"
      :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ? userStore.userInfo.avatar : '/logoD.png')"
      alt="用户头像"
      @error="($event.target as HTMLImageElement).src = '/logo.png'" />

    <div class="flex flex-col justify-center gap-6px">
      <p
        style="
          font-weight: bold !important;
          font-family:
            system-ui,
            -apple-system,
            sans-serif;
        "
        class="text-(16px [--tjg-text-primary])">
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
