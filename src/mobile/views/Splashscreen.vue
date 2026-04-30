<template>
  <!-- 🚀 加载页 DOM -->
  <div id="loading-page" class="h-100vh"></div>
</template>

<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { useSettingStore } from '@/stores/domains/settings/setting'

const settingStore = useSettingStore()
const router = useRouter()
const { normalLogin } = useLoginFlow()

const init = async () => {
  if (settingStore.autoLoginEnabled) {
    normalLogin('MOBILE', true, true)
  } else {
    router.push('/mobile/login')
    await invoke('hide_splash_screen')
  }
}

onMounted(() => {
  init()
})
</script>

<style scoped lang="scss">
#loading-page {
  z-index: 9999;
  background-image: url('/Mobile/2.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 1;
}
</style>
