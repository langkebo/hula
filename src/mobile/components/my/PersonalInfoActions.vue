<template>
  <div class="will-change-transform flex flex-col px-16px">
    <!-- 个人描述 -->
    <div class="mt-2 text-bold-style line-height-24px">
      {{ displayResume }}
    </div>
    <div class="justify-end flex items-center gap-3 mt-16px">
      <van-button
        :disabled="loading"
        @click="emit('edit-profile')"
        plain
        round
        size="small"
        v-if="isMyPage && !isBot"
        class="font-bold px-4 py-10px text-12px min-h-44px">
        {{ t('mobile_personal_info.edit_profile') }}
      </van-button>
      <van-button
        :loading="loading"
        :disabled="loading"
        plain
        round
        size="small"
        @click="emit('delete-friend')"
        color="var(--tjg-color-danger-500)"
        v-if="!isMyPage && isMyFriendState && !isBot"
        class="px-5 py-10px font-bold text-center text-12px min-h-44px">
        {{ t('mobile_personal_info.remove_user') }}
      </van-button>

      <van-button
        type="primary"
        :disabled="loading"
        plain
        round
        size="small"
        @click="emit('add-friend')"
        v-if="!isMyPage && !isMyFriendState && !isBot"
        class="px-5 py-10px font-bold text-center text-12px min-h-44px">
        +&nbsp;
        {{ t('mobile_personal_info.add_friend') }}
      </van-button>
      <van-button
        type="primary"
        plain
        round
        size="small"
        @click="emit('open-chat')"
        :disabled="loading"
        v-if="!isMyPage && isMyFriendState"
        class="px-5 py-10px text-center font-bold text-12px min-h-44px">
        {{ isBot ? t('mobile_personal_info.open_bot') : t('mobile_personal_info.chat') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  displayResume: string
  loading: boolean
  isMyPage: boolean
  isMyFriendState: boolean
  isBot: boolean
}>()

const emit = defineEmits<{
  'edit-profile': []
  'delete-friend': []
  'add-friend': []
  'open-chat': []
}>()

const { t } = useI18n()
</script>

<style lang="scss" scoped>
$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.text-bold-style {
  font-size: 14px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: var(--tjg-text-tertiary);
}
</style>
