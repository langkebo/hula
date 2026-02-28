<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_help.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_help.help_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.user_guide')" is-link @click="openLink('https://matrix.org/docs/guides')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:book-open-variant" :width="20" color="#1989fa" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.faq')" is-link @click="openLink('https://matrix.org/faq')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:frequently-asked-questions" :width="20" color="#52c41a" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.privacy_policy')" is-link @click="router.push('/mobile/privacyAgreement')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-account" :width="20" color="#722ed1" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_help.terms_of_service')"
              is-link
              @click="router.push('/mobile/serviceAgreement')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:file-document-outline" :width="20" color="#fa8c16" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_help.feedback_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.report_bug')" is-link @click="showBugReport = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bug-outline" :width="20" color="#ff4d4f" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.feature_request')" is-link @click="showFeatureRequest = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:lightbulb-outline" :width="20" color="#13c2c2" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.contact_support')" is-link @click="openLink('https://matrix.org/support')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-indigo-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:headset" :width="20" color="#597ef7" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_help.about_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.about_hula')" :label="versionInfo" is-link @click="showAbout = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-gray-100 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:information-outline" :width="20" color="#666" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.check_update')" is-link @click="checkUpdate">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-teal-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:update" :width="20" color="#20c997" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-popup v-model:show="showBugReport" position="bottom" round :style="{ height: '60%' }">
        <div class="p-16px">
          <div class="text-16px font-bold mb-16px">{{ t('mobile_help.report_bug') }}</div>
          <van-field
            v-model="bugReport.title"
            :label="t('mobile_help.bug_title')"
            :placeholder="t('mobile_help.bug_title_placeholder')" />
          <van-field
            v-model="bugReport.description"
            :label="t('mobile_help.bug_description')"
            type="textarea"
            rows="4"
            autosize
            :placeholder="t('mobile_help.bug_description_placeholder')" />
          <div class="mt-16px">
            <van-button type="primary" block @click="submitBugReport">
              {{ t('mobile_help.submit') }}
            </van-button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showFeatureRequest" position="bottom" round :style="{ height: '60%' }">
        <div class="p-16px">
          <div class="text-16px font-bold mb-16px">{{ t('mobile_help.feature_request') }}</div>
          <van-field
            v-model="featureRequest.title"
            :label="t('mobile_help.feature_title')"
            :placeholder="t('mobile_help.feature_title_placeholder')" />
          <van-field
            v-model="featureRequest.description"
            :label="t('mobile_help.feature_description')"
            type="textarea"
            rows="4"
            autosize
            :placeholder="t('mobile_help.feature_description_placeholder')" />
          <div class="mt-16px">
            <van-button type="primary" block @click="submitFeatureRequest">
              {{ t('mobile_help.submit') }}
            </van-button>
          </div>
        </div>
      </van-popup>

      <van-popup v-model:show="showAbout" position="bottom" round :style="{ height: '50%' }">
        <div class="p-16px text-center">
          <div class="text-16px font-bold mb-16px">{{ t('mobile_help.about_hula') }}</div>
          <img src="/logo.png" class="w-80px h-80px mx-auto mb-16px" alt="HuLa Logo" />
          <div class="text-14px text-gray-600 mb-8px">{{ t('mobile_help.about_description') }}</div>
          <div class="text-12px text-gray-400">{{ versionInfo }}</div>
          <div class="text-12px text-gray-400 mt-8px">
            {{ t('mobile_help.copyright') }}
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()

const showBugReport = ref(false)
const showFeatureRequest = ref(false)
const showAbout = ref(false)

const versionInfo = ref('v1.0.0')

const bugReport = ref({
  title: '',
  description: ''
})

const featureRequest = ref({
  title: '',
  description: ''
})

function openLink(url: string) {
  window.open(url, '_blank')
}

async function checkUpdate() {
  showToast({
    type: 'success',
    message: t('mobile_help.latest_version')
  })
}

async function submitBugReport() {
  if (!bugReport.value.title) {
    showToast({
      type: 'fail',
      message: t('mobile_help.title_required')
    })
    return
  }

  showToast({
    type: 'success',
    message: t('mobile_help.submit_success')
  })

  bugReport.value = { title: '', description: '' }
  showBugReport.value = false
}

async function submitFeatureRequest() {
  if (!featureRequest.value.title) {
    showToast({
      type: 'fail',
      message: t('mobile_help.title_required')
    })
    return
  }

  showToast({
    type: 'success',
    message: t('mobile_help.submit_success')
  })

  featureRequest.value = { title: '', description: '' }
  showFeatureRequest.value = false
}
</script>

<style scoped></style>
