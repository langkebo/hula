<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_help.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[--tjg-text-secondary] mb-8px">{{ t('mobile_help.help_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.user_guide')" is-link @click="openLink('https://matrix.org/docs/guides')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.guide">
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#notes" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.faq')" is-link @click="openLink('https://matrix.org/faq')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.faq">
                  <svg class="w-20px h-20px color-[--tjg-color-success-500]" aria-hidden="true">
                    <use href="#tips" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.privacy_policy')" is-link @click="router.push('/mobile/privacyAgreement')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.privacy">
                  <svg class="w-20px h-20px color-[--tjg-color-beta-500]" aria-hidden="true">
                    <use href="#Security" />
                  </svg>
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
                  <svg class="w-20px h-20px color-[--tjg-color-warning-500]" aria-hidden="true">
                    <use href="#file" />
                  </svg>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_help.feedback_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.report_bug')" is-link @click="showBugReport = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.bug">
                  <svg class="w-20px h-20px color-[--tjg-color-danger-500]" aria-hidden="true">
                    <use href="#bug" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.feature_request')" is-link @click="showFeatureRequest = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.feature">
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#tips" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.contact_support')" is-link @click="openLink('https://matrix.org/support')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.support">
                  <svg class="w-20px h-20px color-[--tjg-color-info-500]" aria-hidden="true">
                    <use href="#headset" />
                  </svg>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[--tjg-text-secondary] mt-16px mb-8px">{{ t('mobile_help.about_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_help.about_tjg')" :label="versionInfo" is-link @click="showAbout = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.about">
                  <svg class="w-20px h-20px color-[--tjg-text-secondary]" aria-hidden="true">
                    <use href="#info" />
                  </svg>
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_help.check_update')" is-link @click="checkUpdate">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="iconShellStyles.update">
                  <svg class="w-20px h-20px color-[--tjg-color-success-500]" aria-hidden="true">
                    <use href="#refresh" />
                  </svg>
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-popup v-model:show="showBugReport" position="bottom" round :style="{ height: '60%' }">
        <div class="p-16px">
          <div class="text-16px font-bold mb-16px">{{ t('mobile_help.report_bug') }}</div>
          <van-field v-if="contactInfo" :model-value="contactInfo" :label="t('mobile_help.contact_label')" readonly />
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
          <van-field v-if="contactInfo" :model-value="contactInfo" :label="t('mobile_help.contact_label')" readonly />
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
          <div class="text-16px font-bold mb-16px">{{ t('mobile_help.about_tjg') }}</div>
          <img src="/logo.png" class="w-80px h-80px mx-auto mb-16px" alt="Tjg Logo" />
          <div class="text-14px text-[--tjg-text-secondary] mb-8px">{{ t('mobile_help.about_description') }}</div>
          <div class="text-12px text-[--tjg-text-quaternary]">{{ versionInfo }}</div>
          <div class="text-12px text-[--tjg-text-quaternary] mt-8px">
            {{ t('mobile_help.copyright') }}
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { APP_VERSION } from '@/utils/appVersion'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HelpFeedback')

const { t } = useI18n()
const router = useRouter()
const matrixStore = useMatrixStore()

/** 反馈走外部页面提交，无后端工单接口；仅回填当前账号作为联系方式（T-21） */
const contactInfo = computed(() => matrixStore.userId ?? '')

const showBugReport = ref(false)
const showFeatureRequest = ref(false)
const showAbout = ref(false)

const iconShellStyles = {
  guide: { backgroundColor: 'var(--tjg-color-info-100)' },
  faq: { backgroundColor: 'var(--tjg-color-success-100)' },
  privacy: { backgroundColor: 'var(--tjg-color-beta-100)' },
  terms: { backgroundColor: 'var(--tjg-color-warning-100)' },
  bug: { backgroundColor: 'var(--tjg-color-danger-100)' },
  feature: { backgroundColor: 'var(--tjg-color-info-100)' },
  support: { backgroundColor: 'var(--tjg-color-info-100)' },
  about: { backgroundColor: 'var(--tjg-surface-subtle)' },
  update: { backgroundColor: 'var(--tjg-color-success-100)' }
} as const

const versionInfo = `v${APP_VERSION}`

const checkingUpdate = ref(false)

const bugReport = ref({
  title: '',
  description: ''
})

const featureRequest = ref({
  title: '',
  description: ''
})

const FEEDBACK_ISSUE_URL = 'https://github.com/nichuanfang/nichuanfang.github.io/issues/new'
/** 移动端安装包的唯一获取入口（与桌面端帮助页一致） */
const RELEASE_PAGE_URL = 'https://github.com/nichuanfang/nichuanfang.github.io/releases'

function openLink(url: string) {
  void openExternalUrl(url)
}

/**
 * 检查更新（移动端）。
 *
 * `@tauri-apps/plugin-updater` 官方不支持 Android/iOS（仅桌面端注册），所以这里既不调用它，
 * 也不伪造「已是最新版本」；移动端真实升级路径是发行页/应用商店安装新包，因此如实展示当前
 * 版本并给出可跳转的发行页。桌面端的真实 updater 流程在 `views/CheckUpdate.vue`。
 */
async function checkUpdate() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    await showConfirmDialog({
      title: t('mobile_help.check_update'),
      message: t('mobile_help.mobile_update_hint', { version: versionInfo }),
      confirmButtonText: t('mobile_help.go_to_release_page'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return // 用户取消
  } finally {
    checkingUpdate.value = false
  }

  try {
    await openExternalUrl(RELEASE_PAGE_URL)
  } catch (error) {
    // 与 openLink 一致：打不开外链只记日志，不误报成「检查更新失败」
    logger.warn('Failed to open release page', error)
  }
}

function buildFeedbackUrl(type: 'bug' | 'feature', title: string, description: string): string {
  const params = new URLSearchParams()
  params.set('title', `[${type === 'bug' ? 'Bug' : 'Feature'}] ${title}`)
  params.set(
    'body',
    `${description}\n\n---\nContact: ${contactInfo.value || 'n/a'}\nTJG Mobile ${versionInfo}\nUA: ${navigator.userAgent}`
  )
  return `${FEEDBACK_ISSUE_URL}?${params.toString()}`
}

async function submitReport(
  type: 'bug' | 'feature',
  payload: { title: string; description: string },
  closePopup: () => void
) {
  const title = payload.title.trim()
  if (!title) {
    showToast({
      type: 'fail',
      message: t('mobile_help.title_required')
    })
    return
  }

  const opened = await openExternalUrl(buildFeedbackUrl(type, title, payload.description.trim()))
  if (!opened) {
    logger.error('Failed to open feedback issue page', { type })
    showToast({
      type: 'fail',
      message: t('mobile_help.open_feedback_failed')
    })
    return
  }

  showToast({
    type: 'success',
    message: t('mobile_help.open_feedback_page')
  })
  payload.title = ''
  payload.description = ''
  closePopup()
}

function submitBugReport() {
  void submitReport('bug', bugReport.value, () => {
    showBugReport.value = false
  })
}

function submitFeatureRequest() {
  void submitReport('feature', featureRequest.value, () => {
    showFeatureRequest.value = false
  })
}
</script>

<style scoped></style>
