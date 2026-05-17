<template>
  <n-flex vertical :size="29" data-tauri-drag-region>
    <n-flex justify="center" class="mt-15px">
      <img src="/hula.png" class="w-140px h-60px" alt="" />
    </n-flex>
    <n-flex :size="30" vertical>
      <n-flex justify="center">
        <n-avatar
          round
          :size="110"
          :color="'var(--login-avatar-bg)'"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="AvatarUtils.getAvatarUrl(userInfo?.avatar ?? '')" />
      </n-flex>

      <n-flex justify="center">
        <n-ellipsis style="max-width: 200px" class="text-(18px [--hula-text-secondary])">
          {{ userInfo?.name || '' }}
        </n-ellipsis>
      </n-flex>
    </n-flex>

    <n-flex justify="center">
      <n-button
        :loading="loading"
        :disabled="loginDisabled"
        tertiary
        style="color: var(--hula-text-inverse)"
        class="gradient-button w-200px mt-12px mb-40px"
        @click="emit('login')">
        <span>{{ loginText }}</span>
      </n-button>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ThemeEnum } from '@/enums'
import type { UserInfoType } from '@/services/types.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineProps<{
  loading: boolean
  loginDisabled: boolean
  loginText: string
  userInfo?: UserInfoType
}>()

const emit = defineEmits<{
  login: []
}>()

const settingStore = useSettingStore()
</script>
