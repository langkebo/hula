<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_help.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[--hula-text-secondary] mb-8px">{{ t('mobile_help.help_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.user_guide')" is-link @click="openLink('https://matrix.org/docs/guides')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.guide">
                  <Icon icon="mdi:book-open-variant" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.faq')" is-link @click="openLink('https://matrix.org/faq')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.faq">
                  <Icon icon="mdi:frequently-asked-questions" :width="20" color="var(--hula-color-success-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.privacy_policy')" is-link @click="router.push('/mobile/privacyAgreement')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.privacy">
                  <Icon icon="mdi:shield-account" :width="20" color="var(--hula-color-beta-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_help.terms_of_service')"
              is-link
              @click="router.push('/mobile/serviceAgreement')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.terms">
                  <Icon icon="mdi:file-document-outline" :width="20" color="var(--hula-color-warning-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[--hula-text-secondary] mt-16px mb-8px">
            {{ t('mobile_help.feedback_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.report_bug')" is-link @click="showBugReport = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.bug">
                  <Icon icon="mdi:bug-outline" :width="20" color="var(--hula-color-danger-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.feature_request')" is-link @click="showFeatureRequest = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.feature">
                  <Icon icon="mdi:lightbulb-outline" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.contact_support')" is-link @click="openLink('https://matrix.org/support')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.support">
                  <Icon icon="mdi:headset" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[--hula-text-secondary] mt-16px mb-8px">{{ t('mobile_help.about_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.about_hula')" :label="versionInfo" is-link @click="showAbout = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.about">
                  <Icon icon="mdi:information-outline" :width="20" color="var(--hula-text-secondary)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.check_update')" is-link @click="checkUpdate">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.update">
                  <Icon icon="mdi:update" :width="20" color="var(--hula-color-success-500)" />
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
          <div class="text-14px text-[--hula-text-secondary] mb-8px">{{ t('mobile_help.about_description') }}</div>
          <div class="text-12px text-[--hula-text-quaternary]">{{ versionInfo }}</div>
          <div class="text-12px text-[--hula-text-quaternary] mt-8px">
            {{ t('mobile_help.copyright') }}
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { openExternalUrl } from '@/hooks/useLinkSegments'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HelpFeedback')

const { t } = useI18n()
const router = useRouter()

const showBugReport = ref(false)
const showFeatureRequest = ref(false)
const showAbout = ref(false)

const iconShellStyles = {
  guide: { backgroundColor: 'var(--hula-color-info-100)' },
  faq: { backgroundColor: 'var(--hula-color-success-100)' },
  privacy: { backgroundColor: 'var(--hula-color-beta-100)' },
  terms: { backgroundColor: 'var(--hula-color-warning-100)' },
  bug: { backgroundColor: 'var(--hula-color-danger-100)' },
  feature: { backgroundColor: 'var(--hula-color-info-100)' },
  support: { backgroundColor: 'var(--hula-color-info-100)' },
  about: { backgroundColor: 'var(--hula-surface-subtle)' },
  update: { backgroundColor: 'var(--hula-color-success-100)' }
} as const

const versionInfo = ref('v1.0.0')

const bugReport = ref({
  title: '',
  description: ''
})

const featureRequest = ref({
  title: '',
  description: ''
})

onMounted(() => {
  loadVersion()
})

function loadVersion() {
  try {
    const pkgVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null
    if (pkgVersion) {
      versionInfo.value = `v${pkgVersion}`
    } else {
      const stored = localStorage.getItem('hula-app-version')
      if (stored) {
        versionInfo.value = stored
      }
    }
  } catch {
    versionInfo.value = 'v1.0.0'
  }
}

function openLink(url: string) {
  void openExternalUrl(url)
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

  try {
    const reports = JSON.parse(localStorage.getItem('hula-bug-reports') || '[]')
    reports.push({
      ...bugReport.value,
      timestamp: Date.now(),
      type: 'bug'
    })
    localStorage.setItem('hula-bug-reports', JSON.stringify(reports))

    showToast({
      type: 'success',
      message: t('mobile_help.submit_success')
    })

    bugReport.value = { title: '', description: '' }
    showBugReport.value = false
  } catch (error) {
    logger.error('Failed to submit bug report', error)
    showToast({
      type: 'fail',
      message: t('mobile_help.submit_failed')
    })
  }
}

async function submitFeatureRequest() {
  if (!featureRequest.value.title) {
    showToast({
      type: 'fail',
      message: t('mobile_help.title_required')
    })
    return
  }

  try {
    const requests = JSON.parse(localStorage.getItem('hula-feature-requests') || '[]')
    requests.push({
      ...featureRequest.value,
      timestamp: Date.now(),
      type: 'feature'
    })
    localStorage.setItem('hula-feature-requests', JSON.stringify(requests))

    showToast({
      type: 'success',
      message: t('mobile_help.submit_success')
    })

    featureRequest.value = { title: '', description: '' }
    showFeatureRequest.value = false
  } catch (error) {
    logger.error('Failed to submit feature request', error)
    showToast({
      type: 'fail',
      message: t('mobile_help.submit_failed')
    })
  }
}
</script>

<style scoped></style>
