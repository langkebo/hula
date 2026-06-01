<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar :isOfficial="false" border :hidden-right="true" :room-name="t('mobile_edit_brithday.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col flex-1 gap-20px py-15px px-20px">
          <van-date-picker
            v-model="selectedDate"
            :title="t('mobile_edit_brithday.select_date')"
            class="m-auto rounded-16px" />

          <div class="px-15px flex flex-col w-full box-border rounded-16px bg-[--hula-surface-panel]">
            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">{{ t('mobile_edit_brithday.options.display_birthday_tag') }}</span>
              <van-switch class="shrink-0" v-model="showBirthdayTag" />
            </div>
          </div>

          <div class="px-15px flex flex-col w-full box-border rounded-10px bg-[--hula-surface-panel]">
            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">{{ t('mobile_edit_brithday.options.displsy_age') }}</span>
              <van-switch class="shrink-0" v-model="showAge" />
            </div>

            <div class="h-1px bg-[--hula-border-default]"></div>

            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">
                {{ t('mobile_edit_brithday.options.display_constellation') }}
              </span>
              <van-switch class="shrink-0" v-model="showConstellation" />
            </div>
          </div>

          <div class="flex justify-center mt-20px">
            <van-button type="primary" round block @click="handleSave">
              {{ t('mobile_edit_brithday.save_btn') }}
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
const router = useRouter()
const { showFeedback } = useActionFeedback()
const userStore = useUserStore()
const logger = createLogger('EditBirthday')

const selectedDate = ref(['2024', '01', '01'])
const showBirthdayTag = ref(false)
const showAge = ref(false)
const showConstellation = ref(false)

const formatBirthday = (parts: string[]) => parts.join('-')

const parseBirthday = (value?: string) => {
  if (!value) return ['2024', '01', '01']
  const parts = value.split('-')
  return parts.length === 3 ? parts : ['2024', '01', '01']
}

const handleSave = async () => {
  try {
    await profileService.updateOwnExtendedProfile({
      birthday: formatBirthday(selectedDate.value),
      displayBirthdayTag: showBirthdayTag.value,
      displayAge: showAge.value,
      displayConstellation: showConstellation.value
    })
    showFeedback(t('mobile_edit_brithday.save_success'), 'success')
    router.back()
  } catch (error) {
    if (error instanceof ExtendedProfileUnsupportedError) {
      showFeedback(t('mobile_edit_brithday.unsupported'), 'warning')
      return
    }
    logger.error('Failed to save birthday preferences', error)
    showFeedback(t('mobile_edit_brithday.save_failed'), 'error')
  }
}

onMounted(async () => {
  const userId = userStore.userInfo?.uid
  if (!userId) return
  try {
    const extendedProfile = await profileService.getExtendedProfile(userId)
    selectedDate.value = parseBirthday(
      typeof extendedProfile.birthday === 'string' ? extendedProfile.birthday : undefined
    )
    showBirthdayTag.value = Boolean(extendedProfile.displayBirthdayTag)
    showAge.value = Boolean(extendedProfile.displayAge)
    showConstellation.value = Boolean(extendedProfile.displayConstellation)
  } catch (error) {
    logger.warn('Failed to load birthday preferences', error)
  }
})
</script>

<style lang="scss" scoped></style>
