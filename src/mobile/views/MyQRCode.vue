<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        :room-name="t('mobile_personal_info_qr.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 items-center p-15px z-2 my-15">
          <div class="flex flex-col rounded-15px py-10 bg-[--hula-surface-panel] w-full">
            <div class="flex flex-1 flex-col px-5 gap-10px">
              <div class="flex flex-wrap ps-3 gap-10px">
                <div class="flex h-auto">
                  <img
                    class="w-60px h-60px rounded-full object-cover"
                    :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar || '')"
                    alt="用户头像"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                </div>

                <div
                  class="flex flex-col text-[--hula-text-secondary] h-auto gap-8px overflow-hidden justify-center text-18px whitespace-normal break-words max-w-46">
                  <span class="font-bold">{{ userInfo?.name }}</span>
                  <span class="text-16px text-[--hula-text-quaternary]">
                    {{ t('mobile_personal_info_qr.account') }}:{{ userInfo?.account }}
                  </span>
                </div>
              </div>

              <div class="flex w-auto justify-center">
                <canvas ref="qrCanvasRef" class="rounded-12px"></canvas>
              </div>

              <div class="flex justify-center text-gray">{{ t('mobile_personal_info_qr.scan_to_add') }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MyQRCode')

const { t } = useI18n()
const userStore = useUserStore()
const qrCanvasRef = ref<HTMLCanvasElement>()

const userInfo = computed(() => {
  return userStore.userInfo
})

const randomStr = crypto.randomUUID().split('-')[0]

const qrCodeValue = JSON.stringify({
  type: 'addFriend',
  uid: `${userStore.userInfo?.uid}&${randomStr}`
})

onMounted(async () => {
  if (qrCanvasRef.value) {
    try {
      const QRCode = (await import('qrcode')).default
      const rootStyle = getComputedStyle(document.documentElement)
      const darkColor = rootStyle.getPropertyValue('--hula-brand').trim()
      const lightColor = rootStyle.getPropertyValue('--hula-text-inverse').trim()
      await QRCode.toCanvas(qrCanvasRef.value, qrCodeValue, {
        width: 250,
        margin: 2,
        color: {
          dark: darkColor,
          light: lightColor
        }
      })
    } catch (err) {
      logger.error('生成二维码失败', err)
    }
  }
})
</script>

<style lang="scss" scoped></style>
