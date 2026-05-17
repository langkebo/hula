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

          <div class="px-15px flex flex-col w-full box-border rounded-16px bg-white dark:bg-dark-card">
            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">{{ t('mobile_edit_brithday.options.display_birthday_tag') }}</span>
              <van-switch class="shrink-0" v-model="showBirthdayTag" />
            </div>
          </div>

          <div class="px-15px flex flex-col w-full box-border rounded-10px bg-white dark:bg-dark-card">
            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">{{ t('mobile_edit_brithday.options.displsy_age') }}</span>
              <van-switch class="shrink-0" v-model="showAge" />
            </div>

            <div class="h-1px bg-gray-200 dark:bg-gray-700"></div>

            <div class="flex w-full justify-between items-center py-15px">
              <span class="text-14px shrink-0">
                {{ t('mobile_edit_brithday.options.display_constellation') }}
              </span>
              <van-switch class="shrink-0" v-model="showConstellation" />
            </div>
          </div>

          <div class="flex justify-center mt-20px">
            <van-button type="primary" round block>
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

const { t } = useI18n()

const selectedDate = ref(['2024', '01', '01'])
const showBirthdayTag = ref(false)
const showAge = ref(false)
const showConstellation = ref(false)
</script>

<style lang="scss" scoped></style>
