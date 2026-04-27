<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" :room-name="t('mobile_edit_bio.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <van-form class="rounded-15px p-10px shadow">
            <van-field
              v-model="localBio"
              type="textarea"
              :placeholder="t('mobile_edit_bio.placeholder')"
              class="w-full"
              rows="5"
              autosize
              :maxlength="300"
              show-word-limit
              :spellcheck="false" />
          </van-form>

          <div class="flex justify-center">
            <van-button @click="handleSave" block type="primary" round>
              {{ t('mobile_edit_bio.save_btn') }}
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/domains/user/user'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const userStore = useUserStore()

const router = useRouter()
const localBio = ref(userStore.userInfo?.resume || '')

const handleSave = () => {
  userStore.userInfo!.resume = localBio.value

  router.back()
}

onMounted(() => {
  localBio.value = userStore.userInfo?.resume || ''
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/form-item.scss';
</style>
