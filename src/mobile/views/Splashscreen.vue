<template>
  <!-- 🚀 加载页 DOM -->
  <div id="loading-page" class="h-100vh"></div>
</template>

<script setup lang="ts">
import { useLoginFlow } from '@/composables/user/useLoginFlow'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const settingStore = useSettingStore()
const router = useRouter()
const { normalLogin } = useLoginFlow()

const SPLASH_TIMEOUT_MS = 15_000

const init = async () => {
  if (settingStore.autoLoginEnabled) {
    const splashTimeout = setTimeout(() => {
      router.replace('/mobile/login')
      invokeSilently('hide_splash_screen')
    }, SPLASH_TIMEOUT_MS)

    try {
      await normalLogin('MOBILE', true, true)
    } finally {
      clearTimeout(splashTimeout)
    }
  } else {
    router.push('/mobile/login')
    await invokeSilently('hide_splash_screen')
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
