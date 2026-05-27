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
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { ExtendedProfileUnsupportedError, profileService } from '@/services/matrix/user/MatrixProfileService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const userStore = useUserStore()
const { showFeedback } = useActionFeedback()
const logger = createLogger('EditBio')

const router = useRouter()
const localBio = ref(userStore.userInfo?.resume || '')

const handleSave = async () => {
  try {
    await profileService.updateOwnExtendedProfile({
      resume: localBio.value
    })
    if (userStore.userInfo) {
      userStore.userInfo.resume = localBio.value
    }
    showFeedback(t('mobile_edit_bio.save_success'), 'success')
    router.back()
  } catch (error) {
    if (error instanceof ExtendedProfileUnsupportedError) {
      showFeedback(t('mobile_edit_bio.unsupported'), 'warning')
      return
    }
    logger.error('Failed to save bio', error)
    showFeedback(t('mobile_edit_bio.save_failed'), 'error')
  }
}

onMounted(() => {
  localBio.value = userStore.userInfo?.resume || ''
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/form-item.scss';
</style>
