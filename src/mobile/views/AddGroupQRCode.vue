<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_qrcode.group_title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 items-center p-16px gap-16px">
          <div class="flex flex-col rounded-12px bg-white py-16px px-12px gap-12px w-full">
            <div class="flex flex-wrap gap-12px items-center">
              <van-image
                round
                width="60"
                height="60"
                :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar || '')" />

              <div class="flex flex-col text-gray-700 gap-4px overflow-hidden">
                <div class="font-bold text-18px">{{ userInfo?.name }}</div>
                <div class="text-14px text-gray-500">{{ t('mobile_qrcode.account') }}: {{ userInfo?.account }}</div>
              </div>
            </div>

            <div class="flex justify-center">
              <canvas ref="qrCanvas" class="rounded-8px" />
            </div>

            <div class="flex justify-center text-14px text-gray-400">
              {{ t('mobile_qrcode.scan_hint') }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useUserStore } from '@/stores/domains/user/user'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'

const { t } = useI18n()
const userStore = useUserStore()
const qrCanvas = ref<HTMLCanvasElement | null>(null)

const userInfo = computed(() => {
  return userStore.userInfo
})

const randomStr = crypto.randomUUID().split('-')[0]

const qrCodeValue = JSON.stringify({
  type: 'addFriend',
  uid: `${userStore.userInfo?.uid}&${randomStr}`
})

onMounted(() => {
  drawQRCode()
})

async function drawQRCode() {
  if (!qrCanvas.value) return
  try {
    const QRCode = (await import('qrcode')).default
    await QRCode.toCanvas(qrCanvas.value, qrCodeValue, {
      width: 250,
      margin: 2,
      color: { dark: '#14997E', light: '#FFFFFF' }
    })
  } catch {
    // fallback: show text
    if (qrCanvas.value) {
      const ctx = qrCanvas.value.getContext('2d')
      if (ctx) {
        qrCanvas.value.width = 250
        qrCanvas.value.height = 250
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(0, 0, 250, 250)
        ctx.fillStyle = '#999'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('QR Code', 125, 125)
      }
    }
  }
}
</script>
