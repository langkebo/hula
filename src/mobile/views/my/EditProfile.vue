<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        :room-name="t('mobile_edit_profile.title')" />
    </template>
    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="p-20px">
          <!-- 头像 -->
          <div class="flex justify-center mb-50px">
            <div class="rounded-full relative bg-white w-86px h-86px overflow-hidden" @click="openAvatarCropper">
              <img
                class="absolute size-86px rounded-full object-cover"
                :src="AvatarUtils.getAvatarUrl(localUserInfo.avatar!)"
                @error="($event.target as HTMLImageElement).src = '/logo.png'" />
              <div
                class="absolute h-50% w-full bottom-0 bg-[rgb(50,50,50)] bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-15 backdrop-saturate-100 backdrop-contrast-100"></div>
              <div class="absolute bottom-25% text-center w-full text-12px text-white">
                {{ t('mobile_edit_profile.change_avatar') }}
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              @change="handleFileChange" />
            <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
          </div>
          <!-- 个人信息 -->
          <div class="rounded-16px bg-white dark:bg-[#1a1a1a] overflow-hidden">
            <van-form @submit="saveEditInfo">
              <van-field
                v-model="localUserInfo.name"
                :label="t('mobile_edit_profile.nickname')"
                :placeholder="t('mobile_edit_profile.placeholder.nickname')"
                readonly
                class="bg-transparent!" />

              <div class="mx-16px border-b border-gray-200 dark:border-gray-700"></div>

              <van-field
                v-model="genderText"
                :label="t('mobile_edit_profile.gender')"
                :placeholder="t('mobile_edit_profile.placeholder.gender')"
                readonly
                is-link
                @click="pickerState.gender = true"
                class="bg-transparent!" />

              <div class="mx-16px border-b border-gray-200 dark:border-gray-700"></div>

              <van-field
                v-model="birthday"
                :label="t('mobile_edit_profile.brithday')"
                :placeholder="t('mobile_edit_profile.placeholder.brithday')"
                readonly
                is-link
                @click="toEditBirthday"
                class="bg-transparent!" />

              <div class="mx-16px border-b border-gray-200 dark:border-gray-700"></div>

              <van-field
                v-model="region"
                :label="t('mobile_edit_profile.region')"
                :placeholder="t('mobile_edit_profile.placeholder.brithday')"
                readonly
                is-link
                @click="pickerState.region = true"
                class="bg-transparent!" />

              <div class="mx-16px border-b border-gray-200 dark:border-gray-700"></div>

              <van-field
                v-model="localUserInfo.phone"
                :label="t('mobile_edit_profile.phone')"
                :placeholder="t('mobile_edit_profile.placeholder.phone')"
                readonly
                disabled
                class="bg-transparent!" />

              <div class="mx-16px border-b border-gray-200 dark:border-gray-700"></div>

              <van-field
                v-model="localUserInfo.resume"
                :label="t('mobile_edit_profile.bio')"
                :placeholder="t('mobile_edit_profile.placeholder.bio')"
                type="textarea"
                rows="2"
                autosize
                readonly
                @click="toEditBio"
                class="bg-transparent!" />

              <!-- 性别选择器 -->
              <van-popup v-model:show="pickerState.gender" position="bottom" round>
                <van-picker
                  :columns="pickerColumn.gender"
                  @confirm="pickerConfirm.gender"
                  @cancel="pickerState.gender = false" />
              </van-popup>

              <!-- 地区选择器 -->
              <area-drawer
                v-model:show="pickerState.region"
                @confirm="pickerConfirm.region"
                @cancel="pickerState.region = false" />

              <div class="flex justify-center mt-20px px-16px pb-20px">
                <van-button block type="primary" round native-type="submit">
                  {{ t('mobile_edit_profile.save_btn') }}
                </van-button>
              </div>
            </van-form>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import router from '@/router'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import type { ModifyUserInfoType, UserInfoType } from '@/services/types.ts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EditProfile')

const { t } = useI18n()
const genderText = computed(() => {
  const item = pickerColumn.value.gender.find((i) => i.value === localUserInfo.value.sex)
  return item ? item.text : ''
})

const region = ref('')

const birthday = ref('')

const pickerColumn = ref({
  gender: [
    { text: t('mobile_edit_profile.genders.male'), value: 1 },
    { text: t('mobile_edit_profile.genders.female'), value: 2 }
  ]
})

type PickerOption = { text: string; value: number }

const pickerConfirm = {
  gender: (data: { selectedOptions: PickerOption[] }) => {
    const selected = data.selectedOptions[0].value
    localUserInfo.value.sex = selected
    pickerState.value.gender = false
  },
  region: (data: { selectedOptions: PickerOption[] }) => {
    const selected = data.selectedOptions
    region.value = selected.map((item) => item.text).join('/')
    pickerState.value.region = false
  }
}

const pickerState = ref({
  gender: false,
  region: false,
  date: false
})

const {
  localImageUrl,
  showCropper,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (downloadUrl) => {
    localUserInfo.value.avatar = downloadUrl
    userStore.userInfo!.avatar = downloadUrl
    userStore.userInfo!.avatarUpdateTime = Date.now()
    loginHistoriesStore.loginHistories.filter((item) => item.uid === userStore.userInfo!.uid)[0].avatar = downloadUrl
    updateCurrentUserCache('avatar', downloadUrl)
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

const groupStore = useGroupStore()
const userStore = useUserStore()
const loginHistoriesStore = useLoginHistoriesStore()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({
  name: '',
  sex: 1,
  phone: '',
  avatar: '',
  resume: '',
  modifyNameChance: 0
} as ModifyUserInfoType)

const toEditBirthday = () => {
  router.push('/mobile/mobileMy/editBirthday')
}

const toEditBio = () => {
  router.push('/mobile/mobileMy/editBio')
}

const updateCurrentUserCache = (key: 'name' | 'wearingItemId' | 'avatar', value: string) => {
  const currentUser = userStore.userInfo!.uid && groupStore.getUserInfo(userStore.userInfo!.uid)
  if (currentUser) {
    currentUser[key] = value
  }
}

const saveEditInfo = async () => {
  if (!localUserInfo.value.name || localUserInfo.value.name.trim() === '') {
    window.$message.error(t('mobile_edit_profile.nickname_required'))
    return
  }

  try {
    if (localUserInfo.value.name !== userStore.userInfo?.name) {
      await matrixAccountService.updateDisplayName(localUserInfo.value.name!)
    }

    if (localUserInfo.value.avatar !== userStore.userInfo?.avatar) {
      await matrixAccountService.updateAvatar(localUserInfo.value.avatar!)
    }

    userStore.userInfo!.name = localUserInfo.value.name!
    userStore.userInfo!.sex = localUserInfo.value.sex!
    userStore.userInfo!.phone = localUserInfo.value.phone!
    loginHistoriesStore.updateLoginHistory(<UserInfoType>userStore.userInfo)
    updateCurrentUserCache('name', localUserInfo.value.name)
    if (!localUserInfo.value.modifyNameChance) return
    localUserInfo.value.modifyNameChance -= 1
    window.$message.success(t('mobile_edit_profile.save_success'))
  } catch (error) {
    logger.error('Failed to update profile', error)
    window.$message.error(t('mobile_edit_profile.save_failed'))
  }
}

onMounted(async () => {
  localUserInfo.value = { ...userStore.userInfo! }
})
</script>

<style lang="scss" scoped>
:deep(.van-cell.van-field) {
  padding: 10px 16px;
}

:deep(.van-cell.van-field::after) {
  display: none;
}
</style>
