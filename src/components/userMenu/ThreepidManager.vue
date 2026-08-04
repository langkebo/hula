<template>
  <div class="threepid-manager" role="region" :aria-label="t('setting.threepid.region_label')">
    <section class="threepid-section">
      <header class="section-header">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z" />
          </svg>
          {{ t('setting.threepid.emails_title') }}
        </h3>
      </header>

      <n-list v-if="emails.length" bordered>
        <n-list-item v-for="email in emails" :key="email.address">
          <div class="threepid-item">
            <span class="threepid-address" data-testid="email-address">{{ email.address }}</span>
            <n-button size="small" data-testid="unbind-email" @click="handleUnbind('email', email.address)">
              {{ t('setting.threepid.unbind') }}
            </n-button>
          </div>
        </n-list-item>
      </n-list>
      <n-empty v-else :description="t('setting.threepid.no_emails')" />

      <div class="add-form">
        <n-input
          v-model:value="newEmail"
          data-testid="new-email-input"
          class="add-input"
          :placeholder="t('setting.threepid.email_placeholder')" />
        <n-button type="primary" data-testid="add-email-btn" @click="handleAddEmail">
          {{ t('setting.threepid.add') }}
        </n-button>
      </div>
    </section>

    <section class="threepid-section">
      <header class="section-header">
        <h3 class="section-title">
          <svg class="section-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24 11.36 11.36 0 0 0 3.58.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.36 11.36 0 0 0 .57 3.58 1 1 0 0 1-.24 1.01l-2.21 2.2z" />
          </svg>
          {{ t('setting.threepid.phones_title') }}
        </h3>
      </header>

      <n-list v-if="phones.length" bordered>
        <n-list-item v-for="phone in phones" :key="phone.address">
          <div class="threepid-item">
            <span class="threepid-address" data-testid="phone-masked">{{ maskPhone(phone.address) }}</span>
            <n-button size="small" data-testid="unbind-phone" @click="handleUnbind('phone', phone.address)">
              {{ t('setting.threepid.unbind') }}
            </n-button>
          </div>
        </n-list-item>
      </n-list>
      <n-empty v-else :description="t('setting.threepid.no_phones')" />

      <div class="add-form">
        <n-select
          v-model:value="newCountryCode"
          :options="countryCodeOptions"
          data-testid="country-code-select"
          class="country-code-select" />
        <n-input
          v-model:value="newPhone"
          data-testid="new-phone-input"
          class="add-input"
          :placeholder="t('setting.threepid.phone_placeholder')" />
        <n-button type="primary" data-testid="add-phone-btn" @click="handleAddPhone">
          {{ t('setting.threepid.add') }}
        </n-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NInput, NList, NListItem, NSelect } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({
  name: 'ThreepidManager'
})

interface Threepid {
  address: string
  addedAt?: number
}

defineProps<{
  emails: Threepid[]
  phones: Threepid[]
}>()

const emit = defineEmits<{
  (e: 'add-email', email: string): void
  (e: 'add-phone', countryCode: string, phone: string): void
  (e: 'unbind', type: 'email' | 'phone', address: string): void
}>()

const { t } = useI18n()

const newEmail = ref('')
const newPhone = ref('')
const newCountryCode = ref('+86')

const countryCodeOptions = [
  { label: '+86 中国', value: '+86' },
  { label: '+1 美国/加拿大', value: '+1' },
  { label: '+44 英国', value: '+44' },
  { label: '+81 日本', value: '+81' }
]

const COUNTRY_CODES = ['86', '44', '81', '1']

function maskPhone(phone: string): string {
  const digits = phone.replace(/^\+/, '')
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.length - a.length)
  let cc = ''
  let local = digits
  for (const code of sortedCodes) {
    if (digits.startsWith(code)) {
      cc = code
      local = digits.slice(code.length)
      break
    }
  }
  if (!cc) {
    return phone
  }
  if (local.length < 7) {
    return `+${cc} ${local}`
  }
  const head = local.slice(0, 3)
  const tail = local.slice(-4)
  return `+${cc} ${head}****${tail}`
}

function handleUnbind(type: 'email' | 'phone', address: string) {
  emit('unbind', type, address)
}

function handleAddEmail() {
  const email = newEmail.value.trim()
  if (!email) return
  emit('add-email', email)
  newEmail.value = ''
}

function handleAddPhone() {
  const phone = newPhone.value.trim()
  if (!phone) return
  emit('add-phone', newCountryCode.value, phone)
  newPhone.value = ''
}
</script>

<style scoped lang="scss">
.threepid-manager {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-4);
}

.threepid-section {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.section-header {
  display: flex;
  align-items: center;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.section-icon {
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.threepid-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--tjg-space-2) 0;
}

.threepid-address {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-form {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin-top: var(--tjg-space-2);
}

.add-input {
  flex: 1;
  min-width: 0;
}

.country-code-select {
  width: 140px;
  flex-shrink: 0;
}
</style>
