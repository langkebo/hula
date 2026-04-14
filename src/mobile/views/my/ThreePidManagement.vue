<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_threepid.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <van-notice-bar text="绑定邮箱和手机号可以帮助您找回密码，并让其他用户更容易找到您。" />

        <van-tabs v-model:active="activeTab" class="mt-12px">
          <van-tab title="邮箱" name="email">
            <div class="p-16px">
              <van-empty v-if="emails.length === 0" :description="t('mobile_threepid.email_empty')" />

              <van-cell-group v-else inset>
                <van-cell
                  v-for="email in emails"
                  :key="email.address"
                  :title="email.address"
                  :label="email.validated_at ? t('mobile_threepid.verified') : t('mobile_threepid.pending')">
                  <template #right-icon>
                    <van-button size="small" type="danger" plain @click="handleRemoveEmail(email.address)">
                      {{ t('mobile_threepid.remove') }}
                    </van-button>
                  </template>
                </van-cell>
              </van-cell-group>

              <van-button type="primary" block class="mt-16px" @click="showAddEmailPopup = true">
                {{ t('mobile_threepid.add_email') }}
              </van-button>
            </div>
          </van-tab>

          <van-tab title="手机" name="phone">
            <div class="p-16px">
              <van-empty v-if="phones.length === 0" :description="t('mobile_threepid.phone_empty')" />

              <van-cell-group v-else inset>
                <van-cell
                  v-for="phone in phones"
                  :key="phone.address"
                  :title="phone.address"
                  :label="phone.validated_at ? t('mobile_threepid.verified') : t('mobile_threepid.pending')">
                  <template #right-icon>
                    <van-button size="small" type="danger" plain @click="handleRemovePhone(phone.address)">
                      {{ t('mobile_threepid.remove') }}
                    </van-button>
                  </template>
                </van-cell>
              </van-cell-group>

              <van-button type="primary" block class="mt-16px" @click="showAddPhonePopup = true">
                {{ t('mobile_threepid.add_phone') }}
              </van-button>
            </div>
          </van-tab>
        </van-tabs>

        <van-popup v-model:show="showAddEmailPopup" position="bottom" round :style="{ height: 'auto' }">
          <div class="p-16px">
            <div class="text-16px font-medium mb-16px">{{ t('mobile_threepid.add_email') }}</div>
            <van-field
              v-model="emailValue"
              type="email"
              :placeholder="t('mobile_threepid.email_placeholder')"
              class="mb-16px"
            />
            <van-button type="primary" block @click="handleAddEmail" :loading="loading">
              {{ t('mobile_threepid.send_verification') }}
            </van-button>
          </div>
        </van-popup>

        <van-popup v-model:show="showAddPhonePopup" position="bottom" round :style="{ height: 'auto' }">
          <div class="p-16px">
            <div class="text-16px font-medium mb-16px">{{ t('mobile_threepid.add_phone') }}</div>
            <van-field
              v-model="phoneValue"
              type="tel"
              :placeholder="t('mobile_threepid.phone_placeholder')"
              class="mb-16px"
            />
            <van-button type="primary" block @click="handleAddPhone" :loading="loading">
              {{ t('mobile_threepid.send_verification') }}
            </van-button>
          </div>
        </van-popup>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { showToast } from 'vant'
import { matrixAccountService } from '@/services/matrix/MatrixAccountService'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ThreePid {
  medium: 'email' | 'msisdn'
  address: string
  validated_at: number | null
  added_at: number
}

const threepids = ref<ThreePid[]>([])
const loading = ref(false)
const activeTab = ref<'email' | 'phone'>('email')
const showAddEmailPopup = ref(false)
const showAddPhonePopup = ref(false)
const emailValue = ref('')
const phoneValue = ref('')

const emails = computed(() => threepids.value.filter((p: ThreePid) => p.medium === 'email'))
const phones = computed(() => threepids.value.filter((p: ThreePid) => p.medium === 'msisdn'))

async function loadThreepids(): Promise<void> {
  loading.value = true
  try {
    const result = await matrixAccountService.getThreePids()
    threepids.value = result.threepids || []
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_threepid.load_failed')
    })
  } finally {
    loading.value = false
  }
}

loadThreepids()

async function handleAddEmail(): Promise<void> {
  if (!emailValue.value) return

  loading.value = true
  try {
    await matrixAccountService.addThreePid({
      medium: 'email',
      address: emailValue.value
    })
    showToast({
      type: 'success',
      message: t('mobile_threepid.verification_sent')
    })
    showAddEmailPopup.value = false
    emailValue.value = ''
    await loadThreepids()
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_threepid.add_failed')
    })
  } finally {
    loading.value = false
  }
}

async function handleAddPhone(): Promise<void> {
  if (!phoneValue.value) return

  loading.value = true
  try {
    await matrixAccountService.addThreePid({
      medium: 'msisdn',
      address: phoneValue.value
    })
    showToast({
      type: 'success',
      message: t('mobile_threepid.verification_sent')
    })
    showAddPhonePopup.value = false
    phoneValue.value = ''
    await loadThreepids()
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_threepid.add_failed')
    })
  } finally {
    loading.value = false
  }
}

async function handleRemoveEmail(address: string): Promise<void> {
  loading.value = true
  try {
    await matrixAccountService.deleteThreePid({ medium: 'email', address })
    showToast({
      type: 'success',
      message: t('mobile_threepid.remove_success')
    })
    await loadThreepids()
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_threepid.remove_failed')
    })
  } finally {
    loading.value = false
  }
}

async function handleRemovePhone(address: string): Promise<void> {
  loading.value = true
  try {
    await matrixAccountService.deleteThreePid({ medium: 'msisdn', address })
    showToast({
      type: 'success',
      message: t('mobile_threepid.remove_success')
    })
    await loadThreepids()
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_threepid.remove_failed')
    })
  } finally {
    loading.value = false
  }
}
</script>
