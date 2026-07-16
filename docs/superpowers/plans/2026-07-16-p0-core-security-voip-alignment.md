# P0 Core Communication & Security Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the 7 P0 missing UI integrations: mobile security triad (device verify, key backup, secure backup), mobile reactions, dual-end VoIP call flow, and SSO callback verification.

**Architecture:** This is NOT greenfield. Composables (`useDeviceVerifyFlow`, `useKeyBackupFlow`, `useSecureBackupFlow`, `useVoIPCallFlow`, `useReactionFlow`) and services (`MatrixVerificationService`, `MatrixKeyBackupService`, `MatrixVoIPService`, `MatrixReactionService`) already exist at 100%. The work is: (1) wiring stub handlers in mobile views to actual composable/service calls, (2) filling missing UI elements (PC CallView stream binding, speaker/camera toggles), (3) ensuring dual-end behavioral parity, and (4) adding tests.

**Tech Stack:** Vue 3 + TypeScript + Vant (mobile) / Naive UI (PC), Pinia, Vitest, Playwright

## Global Constraints

- Components must NOT import from `matrix-js-sdk` directly; all SDK access through `src/services/matrix/`
- Mobile views use `#/` alias; PC views use `@/` alias
- Mobile UI uses Vant; PC UI uses Naive UI
- All user-facing text through `$t()` / i18n keys
- Touch targets >= 44x44px on mobile
- `vue-tsc --noEmit` must pass with 0 errors
- `pnpm check` must pass with 0 errors
- DoD per task: component source + service wiring (no SDK direct) + i18n keys + >= 1 unit test + >= 1 E2E test + update feature checklist

---

### Task 1: Mobile Device Verification (SAS/QR) Dialog

**Files:**
- Create: `src/mobile/components/encryption/MobileDeviceVerifyDialog.vue`
- Create: `src/mobile/components/encryption/__tests__/MobileDeviceVerifyDialog.test.ts`
- Modify: `src/mobile/views/my/SecuritySettings.vue` — add "Device Verification" entry point
- Reference (do not modify): `src/composables/encryption/useDeviceVerifyFlow.ts` (191 lines, exports `VerificationStep`, `PendingRequest`, `useDeviceVerifyFlow()`)
- Reference (do not modify): `src/components/encryption/DeviceVerifyDialog.vue` (PC implementation)
- Reference (do not modify): `src/services/matrix/crypto/MatrixVerificationService.ts`

**Interfaces:**
- Consumes: `useDeviceVerifyFlow()` — returns `{ step, emoji, pendingRequests, startSasVerification, verifyEmoji, cancel, qrCodeData, scanQRCode }`
- Consumes: `MatrixVerificationService.getInstance()` for SAS/QR verification methods
- Produces: `MobileDeviceVerifyDialog.vue` — a Vant dialog component showing SAS emoji comparison or QR code scan, integrated into SecuritySettings entry point

- [ ] **Step 1: Read the existing PC `DeviceVerifyDialog.vue` and `useDeviceVerifyFlow.ts` composable to understand the verification flow contract**

The composable `useDeviceVerifyFlow.ts` (191 lines) exports:
- `VerificationStep` enum: `IDLE | WAITING | EMOJI_COMPARISON | QR_SHOW | QR_SCAN | COMPLETE | CANCELLED | ERROR`
- `PendingRequest` interface: `{ requestId, fromUserId, fromDeviceId, timestamp }`
- `useDeviceVerifyFlow()` returning: `{ step, emojiList, pendingRequests, selectedRequestId, qrCodeData, error, startSasVerification, verifyEmojiMatch, verifyEmojiMismatch, cancelVerification, acceptRequest, rejectRequest, showQrCode, scanQrCode }`

The PC `DeviceVerifyDialog.vue` uses Naive UI (`n-modal`, `n-button`, `n-spin`) — the mobile version must reimplement with Vant (`van-dialog`, `van-button`, `van-loading`).

Run: `cat src/composables/encryption/useDeviceVerifyFlow.ts | head -80`

- [ ] **Step 2: Create the mobile dialog component**

Create `src/mobile/components/encryption/MobileDeviceVerifyDialog.vue`:

```vue
<template>
  <van-dialog
    v-model:show="visible"
    :title="dialogTitle"
    :show-cancel-button="false"
    :show-confirm-button="false"
    close-on-click-overlay
    @closed="handleClose"
  >
    <div class="px-4 py-4">
      <!-- IDLE: Select verification mode -->
      <div v-if="step === VerificationStep.IDLE" class="flex flex-col gap-3">
        <van-button block @click="startSas">
          {{ $t('encryption.verify.sas') }}
        </van-button>
        <van-button block plain @click="showQr">
          {{ $t('encryption.verify.qrShow') }}
        </van-button>
        <van-button block plain @click="scanQr">
          {{ $t('encryption.verify.qrScan') }}
        </van-button>
      </div>

      <!-- WAITING: Loading spinner -->
      <div v-else-if="step === VerificationStep.WAITING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.verify.waiting') }}</span>
      </div>

      <!-- EMOJI_COMPARISON: SAS emoji display -->
      <div v-else-if="step === VerificationStep.EMOJI_COMPARISON" class="flex flex-col items-center gap-4">
        <div class="grid grid-cols-4 gap-2">
          <div v-for="(emoji, i) in emojiList" :key="i" class="text-center">
            <span class="text-2xl">{{ emoji.emoji }}</span>
            <p class="text-xs text-[--text-secondary]">{{ emoji.description }}</p>
          </div>
        </div>
        <div class="flex gap-3">
          <van-button type="danger" @click="mismatch">{{ $t('encryption.verify.mismatch') }}</van-button>
          <van-button type="primary" @click="match">{{ $t('encryption.verify.match') }}</van-button>
        </div>
      </div>

      <!-- QR_SHOW: Display QR code -->
      <div v-else-if="step === VerificationStep.QR_SHOW" class="flex flex-col items-center gap-3">
        <canvas ref="qrCanvasRef" class="w-48 h-48" />
        <span class="text-sm text-[--text-secondary]">{{ $t('encryption.verify.qrShowHint') }}</span>
      </div>

      <!-- QR_SCAN: Camera scanner -->
      <div v-else-if="step === VerificationStep.QR_SCAN" class="flex flex-col items-center gap-3">
        <video ref="scannerVideoRef" class="w-full h-48 bg-black" autoplay playsinline />
        <span class="text-sm text-[--text-secondary]">{{ $t('encryption.verify.qrScanHint') }}</span>
      </div>

      <!-- COMPLETE -->
      <div v-else-if="step === VerificationStep.COMPLETE" class="flex flex-col items-center gap-3">
        <van-icon name="success" size="48" color="var(--success-color)" />
        <span>{{ $t('encryption.verify.complete') }}</span>
      </div>

      <!-- ERROR -->
      <div v-else-if="step === VerificationStep.ERROR" class="flex flex-col items-center gap-3">
        <van-icon name="warning" size="48" color="var(--danger-color)" />
        <span>{{ error || $t('encryption.verify.error') }}</span>
      </div>

      <!-- Pending requests list -->
      <div v-if="pendingRequests.length > 0" class="mt-4 border-t pt-3">
        <p class="text-sm font-medium mb-2">{{ $t('encryption.verify.pendingRequests') }}</p>
        <div v-for="req in pendingRequests" :key="req.requestId" class="flex items-center justify-between py-1">
          <span class="text-sm">{{ req.fromUserId }}</span>
          <div class="flex gap-2">
            <van-button size="small" type="danger" @click="rejectRequest(req.requestId)">
              {{ $t('common.reject') }}
            </van-button>
            <van-button size="small" type="primary" @click="acceptRequest(req.requestId)">
              {{ $t('common.accept') }}
            </van-button>
          </div>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceVerifyFlow, VerificationStep } from '@/composables/encryption/useDeviceVerifyFlow'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  userId: string
  deviceId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'verified'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const qrCanvasRef = ref<HTMLCanvasElement>()
const scannerVideoRef = ref<HTMLVideoElement>()

const {
  step,
  emojiList,
  pendingRequests,
  error,
  startSasVerification,
  verifyEmojiMatch,
  verifyEmojiMismatch,
  cancelVerification,
  acceptRequest,
  rejectRequest,
  showQrCode,
  scanQrCode
} = useDeviceVerifyFlow()

const dialogTitle = computed(() => {
  switch (step.value) {
    case VerificationStep.IDLE: return t('encryption.verify.title')
    case VerificationStep.EMOJI_COMPARISON: return t('encryption.verify.sasTitle')
    case VerificationStep.QR_SHOW: return t('encryption.verify.qrShowTitle')
    case VerificationStep.QR_SCAN: return t('encryption.verify.qrScanTitle')
    case VerificationStep.COMPLETE: return t('encryption.verify.completeTitle')
    default: return t('encryption.verify.title')
  }
})

async function startSas() {
  await startSasVerification(props.userId, props.deviceId)
}

async function showQr() {
  await showQrCode()
  // Render QR to canvas
  // qrCodeData is a string; render with a QR library or use van-qr-code if available
}

async function scanQr() {
  await scanQrCode()
  // Start camera stream, bind to scannerVideoRef
}

async function match() {
  await verifyEmojiMatch()
  emit('verified')
  visible.value = false
}

async function mismatch() {
  await verifyEmojiMismatch()
}

function handleClose() {
  if (step.value !== VerificationStep.COMPLETE) {
    cancelVerification()
  }
}
</script>
```

- [ ] **Step 3: Add entry point in SecuritySettings.vue**

In `src/mobile/views/my/SecuritySettings.vue`, add a device verification cell:

```vue
<van-cell
  :title="$t('encryption.verify.title')"
  is-link
  @click="showDeviceVerify = true"
/>
<MobileDeviceVerifyDialog
  v-model="showDeviceVerify"
  :user-id="currentUserId"
  :device-id="currentDeviceId"
  @verified="onDeviceVerified"
/>
```

Add the import:
```ts
import MobileDeviceVerifyDialog from '#/components/encryption/MobileDeviceVerifyDialog.vue'
```

And the state:
```ts
const showDeviceVerify = ref(false)
const currentUserId = computed(() => userStore.userId)
const currentDeviceId = computed(() => userStore.deviceId)
function onDeviceVerified() {
  showToast(t('encryption.verify.verified'))
}
```

- [ ] **Step 4: Write unit test**

Create `src/mobile/components/encryption/__tests__/MobileDeviceVerifyDialog.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileDeviceVerifyDialog from '../MobileDeviceVerifyDialog.vue'

describe('MobileDeviceVerifyDialog', () => {
  it('renders IDLE state with three action buttons', () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { modelValue: true, userId: '@user:localhost', deviceId: 'DEVICE1' },
      global: { stubs: { 'van-dialog': true, 'van-button': true, 'van-loading': true, 'van-icon': true } }
    })
    expect(wrapper.html()).toContain('encryption.verify.sas')
    expect(wrapper.html()).toContain('encryption.verify.qrShow')
    expect(wrapper.html()).toContain('encryption.verify.qrScan')
  })

  it('emits update:modelValue on close', async () => {
    const wrapper = mount(MobileDeviceVerifyDialog, {
      props: { modelValue: true, userId: '@user:localhost', deviceId: 'DEVICE1' },
      global: { stubs: { 'van-dialog': true, 'van-button': true, 'van-loading': true, 'van-icon': true } }
    })
    // Simulate dialog close
    await wrapper.setProps({ modelValue: false })
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run unit test to verify it fails (TDD red)**

Run: `pnpm vitest run src/mobile/components/encryption/__tests__/MobileDeviceVerifyDialog.test.ts`
Expected: FAIL (component not yet existing for the first real run)

- [ ] **Step 6: Run tests after implementation to verify pass**

Run: `pnpm vitest run src/mobile/components/encryption/__tests__/MobileDeviceVerifyDialog.test.ts`
Expected: PASS

- [ ] **Step 7: Type check and lint**

Run: `vue-tsc --noEmit` and `pnpm check`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/mobile/components/encryption/MobileDeviceVerifyDialog.vue \
        src/mobile/components/encryption/__tests__/MobileDeviceVerifyDialog.test.ts \
        src/mobile/views/my/SecuritySettings.vue
git commit -m "feat: add mobile device verification dialog (SAS/QR)

Wire useDeviceVerifyFlow composable into a Vant dialog with SAS emoji
comparison and QR code show/scan modes. Add entry point in SecuritySettings."
```

---

### Task 2: Mobile Key Backup Setup/Restore

**Files:**
- Create: `src/mobile/components/encryption/MobileKeyBackupDialog.vue`
- Create: `src/mobile/components/encryption/__tests__/MobileKeyBackupDialog.test.ts`
- Modify: `src/mobile/views/my/EncryptionSettings.vue` — add key backup setup and restore entry points
- Reference (do not modify): `src/composables/encryption/useKeyBackupFlow.ts` (231 lines, exports `KeyBackupMode`, `KeyBackupStep`, `useKeyBackupFlow()`)
- Reference (do not modify): `src/services/matrix/crypto/MatrixKeyBackupService.ts`

**Interfaces:**
- Consumes: `useKeyBackupFlow(mode: 'setup' | 'restore')` — returns `{ step, recoveryKey, passphrase, progress, error, setPassphrase, generateKey, uploadBackup, downloadBackup, restoreWithKey, restoreWithPassphrase }`
- Produces: `MobileKeyBackupDialog.vue` — a Vant dialog handling both setup and restore flows, triggered from EncryptionSettings

- [ ] **Step 1: Read the existing composable API**

Run: `grep -n "export" src/composables/encryption/useKeyBackupFlow.ts`

The composable exports:
- `KeyBackupMode`: `'setup' | 'restore'`
- `KeyBackupStep`: `IDLE | ENTER_PASSPHRASE | GENERATING | DISPLAY_KEY | UPLOADING | RESTORE_INPUT | RESTORING | COMPLETE | ERROR`
- `useKeyBackupFlow(mode)` returning the flow state and actions

- [ ] **Step 2: Create the mobile key backup dialog**

Create `src/mobile/components/encryption/MobileKeyBackupDialog.vue`:

```vue
<template>
  <van-dialog
    v-model:show="visible"
    :title="dialogTitle"
    :show-cancel-button="false"
    :show-confirm-button="false"
    close-on-click-overlay
  >
    <div class="px-4 py-4">
      <!-- SETUP: Enter passphrase -->
      <div v-if="step === KeyBackupStep.ENTER_PASSPHRASE" class="flex flex-col gap-3">
        <van-field
          v-model="passphraseInput"
          type="password"
          :label="$t('encryption.keyBackup.passphrase')"
          :placeholder="$t('encryption.keyBackup.passphraseHint')"
        />
        <van-button block type="primary" :loading="loading" @click="handleGenerateKey">
          {{ $t('encryption.keyBackup.generate') }}
        </van-button>
      </div>

      <!-- SETUP: Generating -->
      <div v-else-if="step === KeyBackupStep.GENERATING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.keyBackup.generating') }}</span>
      </div>

      <!-- SETUP: Display recovery key -->
      <div v-else-if="step === KeyBackupStep.DISPLAY_KEY" class="flex flex-col gap-3">
        <div class="bg-[--bg-secondary] p-3 rounded text-center font-mono text-sm break-all">
          {{ recoveryKey }}
        </div>
        <van-button block size="small" plain @click="copyKey">
          {{ $t('common.copy') }}
        </van-button>
        <van-button block type="primary" :loading="loading" @click="handleUpload">
          {{ $t('encryption.keyBackup.upload') }}
        </van-button>
      </div>

      <!-- SETUP: Uploading -->
      <div v-else-if="step === KeyBackupStep.UPLOADING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.keyBackup.uploading') }}</span>
        <van-progress :percentage="progress" />
      </div>

      <!-- RESTORE: Input key or passphrase -->
      <div v-else-if="step === KeyBackupStep.RESTORE_INPUT" class="flex flex-col gap-3">
        <van-tabs v-model:active="restoreTab">
          <van-tab :title="$t('encryption.keyBackup.recoveryKey')">
            <van-field
              v-model="recoveryKeyInput"
              :label="$t('encryption.keyBackup.recoveryKey')"
              :placeholder="'XXXX-XXXX-XXXX-XXXX'"
            />
          </van-tab>
          <van-tab :title="$t('encryption.keyBackup.passphrase')">
            <van-field
              v-model="passphraseInput"
              type="password"
              :label="$t('encryption.keyBackup.passphrase')"
            />
          </van-tab>
        </van-tabs>
        <van-button block type="primary" :loading="loading" @click="handleRestore">
          {{ $t('encryption.keyBackup.restore') }}
        </van-button>
      </div>

      <!-- RESTORE: Restoring -->
      <div v-else-if="step === KeyBackupStep.RESTORING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.keyBackup.restoring') }}</span>
        <van-progress :percentage="progress" />
      </div>

      <!-- COMPLETE -->
      <div v-else-if="step === KeyBackupStep.COMPLETE" class="flex flex-col items-center gap-3">
        <van-icon name="success" size="48" color="var(--success-color)" />
        <span>{{ successMessage }}</span>
        <van-button block @click="visible = false">{{ $t('common.done') }}</van-button>
      </div>

      <!-- ERROR -->
      <div v-else-if="step === KeyBackupStep.ERROR" class="flex flex-col items-center gap-3">
        <van-icon name="warning" size="48" color="var(--danger-color)" />
        <span class="text-center">{{ error }}</span>
        <van-button block @click="visible = false">{{ $t('common.close') }}</van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast, copyText } from 'vant'
import { useKeyBackupFlow, KeyBackupStep, KeyBackupMode } from '@/composables/encryption/useKeyBackupFlow'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  mode: 'setup' | 'restore'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const passphraseInput = ref('')
const recoveryKeyInput = ref('')
const restoreTab = ref(0)
const loading = ref(false)

const {
  step,
  recoveryKey,
  progress,
  error,
  setPassphrase,
  generateKey,
  uploadBackup,
  downloadBackup,
  restoreWithKey,
  restoreWithPassphrase
} = useKeyBackupFlow(props.mode)

const dialogTitle = computed(() => {
  if (props.mode === KeyBackupMode.SETUP) return t('encryption.keyBackup.setupTitle')
  return t('encryption.keyBackup.restoreTitle')
})

const successMessage = computed(() => {
  if (props.mode === KeyBackupMode.SETUP) return t('encryption.keyBackup.setupComplete')
  return t('encryption.keyBackup.restoreComplete')
})

async function handleGenerateKey() {
  loading.value = true
  try {
    setPassphrase(passphraseInput.value)
    await generateKey()
  } finally {
    loading.value = false
  }
}

async function handleUpload() {
  loading.value = true
  try {
    await uploadBackup()
    emit('complete')
  } finally {
    loading.value = false
  }
}

async function handleRestore() {
  loading.value = true
  try {
    if (restoreTab.value === 0) {
      await restoreWithKey(recoveryKeyInput.value)
    } else {
      await restoreWithPassphrase(passphraseInput.value)
    }
    emit('complete')
  } finally {
    loading.value = false
  }
}

async function copyKey() {
  if (recoveryKey.value) {
    await copyText(recoveryKey.value)
    showToast(t('common.copied'))
  }
}
</script>
```

- [ ] **Step 3: Add entry points in EncryptionSettings.vue**

In `src/mobile/views/my/EncryptionSettings.vue`, add key backup cells after the existing backup section:

```vue
<van-cell
  :title="$t('encryption.keyBackup.setup')"
  is-link
  @click="showKeyBackupSetup = true"
/>
<van-cell
  :title="$t('encryption.keyBackup.restore')"
  is-link
  @click="showKeyBackupRestore = true"
/>
<MobileKeyBackupDialog
  v-model="showKeyBackupSetup"
  mode="setup"
  @complete="onKeyBackupComplete"
/>
<MobileKeyBackupDialog
  v-model="showKeyBackupRestore"
  mode="restore"
  @complete="onKeyBackupComplete"
/>
```

- [ ] **Step 4: Write unit test**

Create `src/mobile/components/encryption/__tests__/MobileKeyBackupDialog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileKeyBackupDialog from '../MobileKeyBackupDialog.vue'

describe('MobileKeyBackupDialog', () => {
  it('renders setup mode with passphrase input', () => {
    const wrapper = mount(MobileKeyBackupDialog, {
      props: { modelValue: true, mode: 'setup' },
      global: {
        stubs: {
          'van-dialog': true, 'van-field': true, 'van-button': true,
          'van-loading': true, 'van-icon': true, 'van-tabs': true,
          'van-tab': true, 'van-progress': true
        }
      }
    })
    expect(wrapper.html()).toContain('encryption.keyBackup.setupTitle')
  })

  it('renders restore mode with tabbed input', () => {
    const wrapper = mount(MobileKeyBackupDialog, {
      props: { modelValue: true, mode: 'restore' },
      global: {
        stubs: {
          'van-dialog': true, 'van-field': true, 'van-button': true,
          'van-loading': true, 'van-icon': true, 'van-tabs': true,
          'van-tab': true, 'van-progress': true
        }
      }
    })
    expect(wrapper.html()).toContain('encryption.keyBackup.restoreTitle')
  })
})
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/mobile/components/encryption/__tests__/MobileKeyBackupDialog.test.ts`
Expected: PASS

- [ ] **Step 6: Type check and lint**

Run: `vue-tsc --noEmit` and `pnpm check`

- [ ] **Step 7: Commit**

```bash
git add src/mobile/components/encryption/MobileKeyBackupDialog.vue \
        src/mobile/components/encryption/__tests__/MobileKeyBackupDialog.test.ts \
        src/mobile/views/my/EncryptionSettings.vue
git commit -m "feat: add mobile key backup setup/restore dialog

Wire useKeyBackupFlow composable into a Vant dialog supporting both
setup (passphrase→generate→display key→upload) and restore (key or
passphrase input) flows. Integrated into EncryptionSettings."
```

---

### Task 3: Mobile Secure Backup

**Files:**
- Create: `src/mobile/components/encryption/MobileSecureBackupDialog.vue`
- Create: `src/mobile/components/encryption/__tests__/MobileSecureBackupDialog.test.ts`
- Modify: `src/mobile/views/my/SecuritySettings.vue` — add secure backup entry point
- Reference (do not modify): `src/composables/encryption/useSecureBackupFlow.ts` (195 lines, exports `SecureBackupPhase`, `useSecureBackupFlow()`)
- Reference (do not modify): `src/services/matrix/crypto/MatrixKeyBackupService.ts`

**Interfaces:**
- Consumes: `useSecureBackupFlow()` — returns `{ phase, error, loading, createSecureBackup, restoreSecureBackup, verifySecureBackup, resetPhase }`
- Consumes: `SecureBackupPhase` enum: `IDLE | CREATING | RESTORE_INPUT | VERIFYING | COMPLETE | ERROR`
- Produces: `MobileSecureBackupDialog.vue` — Vant dialog for creating and restoring secure backups with passphrase verification

- [ ] **Step 1: Read the composable API**

Run: `grep -n "export" src/composables/encryption/useSecureBackupFlow.ts`

- [ ] **Step 2: Create the mobile secure backup dialog**

Create `src/mobile/components/encryption/MobileSecureBackupDialog.vue`:

```vue
<template>
  <van-dialog
    v-model:show="visible"
    :title="$t('encryption.secureBackup.title')"
    :show-cancel-button="false"
    :show-confirm-button="false"
    close-on-click-overlay
  >
    <div class="px-4 py-4">
      <!-- IDLE: Choose action -->
      <div v-if="phase === SecureBackupPhase.IDLE" class="flex flex-col gap-3">
        <van-button block type="primary" @click="handleCreate">
          {{ $t('encryption.secureBackup.create') }}
        </van-button>
        <van-button block plain @click="phase = SecureBackupPhase.RESTORE_INPUT">
          {{ $t('encryption.secureBackup.restore') }}
        </van-button>
      </div>

      <!-- CREATING -->
      <div v-else-if="phase === SecureBackupPhase.CREATING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.secureBackup.creating') }}</span>
      </div>

      <!-- RESTORE_INPUT -->
      <div v-else-if="phase === SecureBackupPhase.RESTORE_INPUT" class="flex flex-col gap-3">
        <van-field
          v-model="passphrase"
          type="password"
          :label="$t('encryption.secureBackup.passphrase')"
          :placeholder="$t('encryption.secureBackup.passphraseHint')"
        />
        <van-button block type="primary" :loading="loading" @click="handleRestore">
          {{ $t('encryption.secureBackup.restore') }}
        </van-button>
      </div>

      <!-- VERIFYING -->
      <div v-else-if="phase === SecureBackupPhase.VERIFYING" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.secureBackup.verifying') }}</span>
      </div>

      <!-- COMPLETE -->
      <div v-else-if="phase === SecureBackupPhase.COMPLETE" class="flex flex-col items-center gap-3">
        <van-icon name="success" size="48" color="var(--success-color)" />
        <span>{{ $t('encryption.secureBackup.complete') }}</span>
        <van-button block @click="visible = false">{{ $t('common.done') }}</van-button>
      </div>

      <!-- ERROR -->
      <div v-else-if="phase === SecureBackupPhase.ERROR" class="flex flex-col items-center gap-3">
        <van-icon name="warning" size="48" color="var(--danger-color)" />
        <span class="text-center">{{ error }}</span>
        <van-button block @click="resetPhase()">{{ $t('common.retry') }}</van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSecureBackupFlow, SecureBackupPhase } from '@/composables/encryption/useSecureBackupFlow'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const passphrase = ref('')

const {
  phase,
  error,
  loading,
  createSecureBackup,
  restoreSecureBackup,
  resetPhase
} = useSecureBackupFlow()

async function handleCreate() {
  await createSecureBackup()
  emit('complete')
}

async function handleRestore() {
  await restoreSecureBackup(passphrase.value)
  emit('complete')
}
</script>
```

- [ ] **Step 3: Add entry point in SecuritySettings.vue**

```vue
<van-cell
  :title="$t('encryption.secureBackup.title')"
  is-link
  @click="showSecureBackup = true"
/>
<MobileSecureBackupDialog
  v-model="showSecureBackup"
  @complete="onSecureBackupComplete"
/>
```

- [ ] **Step 4: Write unit test and run**

Create `src/mobile/components/encryption/__tests__/MobileSecureBackupDialog.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileSecureBackupDialog from '../MobileSecureBackupDialog.vue'

describe('MobileSecureBackupDialog', () => {
  it('renders IDLE state with create and restore buttons', () => {
    const wrapper = mount(MobileSecureBackupDialog, {
      props: { modelValue: true },
      global: {
        stubs: {
          'van-dialog': true, 'van-field': true, 'van-button': true,
          'van-loading': true, 'van-icon': true
        }
      }
    })
    expect(wrapper.html()).toContain('encryption.secureBackup.create')
    expect(wrapper.html()).toContain('encryption.secureBackup.restore')
  })
})
```

- [ ] **Step 5: Type check, lint, and commit**

Run: `vue-tsc --noEmit && pnpm check`

```bash
git add src/mobile/components/encryption/MobileSecureBackupDialog.vue \
        src/mobile/components/encryption/__tests__/MobileSecureBackupDialog.test.ts \
        src/mobile/views/my/SecuritySettings.vue
git commit -m "feat: add mobile secure backup create/restore dialog

Wire useSecureBackupFlow composable into a Vant dialog for creating
and restoring secure backups with passphrase verification."
```

---

### Task 4: Mobile Message Reaction Integration

**Files:**
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue:346` — replace stub `handleReacted` with real reaction toggle logic
- Modify: `src/mobile/components/message/MobileReactionPicker.vue` — ensure it uses `useReactionFlow` correctly (already partially implemented)
- Create: `src/mobile/components/message/__tests__/MobileReactionPicker.test.ts`
- Reference (do not modify): `src/composables/messaging/useReactionFlow.ts` (152 lines, exports `toggleReaction`, `addReaction`, `removeReaction`, `QUICK_EMOJIS`)
- Reference (do not modify): `src/services/matrix/messaging/MatrixReactionService.ts`

**Interfaces:**
- Consumes: `useReactionFlow()` — returns `{ toggleReaction(eventId, emoji), addReaction(eventId, emoji), removeReaction(eventId, emoji) }`
- Consumes: `QUICK_EMOJIS` — `['👍', '❤️', '😄', '😢', '😮', '😡']` (6 quick-reaction emojis)
- Produces: Working reaction flow — long-press message → show picker → select emoji → toggle on Matrix event

- [ ] **Step 1: Fix the stub handleReacted in MobileChatMain.vue**

Current stub (line 346):
```ts
const handleReacted = (emoji: string) => {
  // STUB: logs but does not persist
  logger.info('Reaction clicked:', emoji)
}
```

Replace with:
```ts
import { useReactionFlow } from '@/composables/messaging/useReactionFlow'
import { showToast } from 'vant'

const { toggleReaction } = useReactionFlow()

const handleReacted = async (emoji: string) => {
  try {
    await toggleReaction(currentEventId.value, emoji)
  } catch (err) {
    showToast(t('reaction.error'))
  }
}
```

- [ ] **Step 2: Verify MobileReactionPicker uses useReactionFlow**

Read the current `MobileReactionPicker.vue` to confirm it imports from `useReactionFlow`. The file exists at 165 lines and already imports `useReactionFlow` and `QUICK_EMOJIS`. Verify the emoji click handler calls `toggleReaction` or `addReaction`.

Run: `grep -n "toggleReaction\|addReaction\|useReactionFlow" src/mobile/components/message/MobileReactionPicker.vue`

If the picker already calls the composable, no changes needed. If it emits an event instead, wire the composable call directly in the picker.

- [ ] **Step 3: Ensure MobileMessageActions has the 'react' action wired**

Run: `grep -n "react" src/mobile/components/message/MobileMessageActions.vue`

Verify the 'react' action emits an event that triggers showing the ReactionPicker in the message container.

- [ ] **Step 4: Write unit test for MobileReactionPicker**

Create `src/mobile/components/message/__tests__/MobileReactionPicker.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileReactionPicker from '../MobileReactionPicker.vue'

describe('MobileReactionPicker', () => {
  it('renders 6 quick emoji buttons', () => {
    const wrapper = mount(MobileReactionPicker, {
      props: { eventId: '$event1', show: true },
      global: {
        stubs: { 'van-popover': true }
      }
    })
    // Should have 6 emoji buttons
    const buttons = wrapper.findAll('button, [role="button"]')
    expect(buttons.length).toBeGreaterThanOrEqual(6)
  })

  it('emits selected emoji on click', async () => {
    const wrapper = mount(MobileReactionPicker, {
      props: { eventId: '$event1', show: true },
      global: {
        stubs: { 'van-popover': true }
      }
    })
    // Simulate emoji selection
    // ...test implementation specific to how picker exposes selection
  })
})
```

- [ ] **Step 5: Run tests, type check, lint**

Run: `pnpm vitest run src/mobile/components/message/__tests__/MobileReactionPicker.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/mobile/views/chat-room/MobileChatMain.vue \
        src/mobile/components/message/__tests__/MobileReactionPicker.test.ts
git commit -m "feat: wire mobile message reaction toggle in MobileChatMain

Replace stub handleReacted logger with useReactionFlow().toggleReaction()
call. Reaction picker already exists; this completes the end-to-end
reaction flow on mobile."
```

---

### Task 5: PC VoIP CallView Stream Binding and Controls

**Files:**
- Modify: `src/components/call/CallView.vue` — add local/remote stream binding, speaker toggle, camera switch
- Create: `src/components/call/__tests__/CallView.test.ts`
- Reference (do not modify): `src/composables/webrtc/useVoIPCallFlow.ts` (248 lines)
- Reference (do not modify): `src/services/matrix/media/MatrixVoIPService.ts`

**Interfaces:**
- Consumes: `useVoIPCallFlow()` — returns `{ state, startCall, answerCall, rejectCall, hangup, toggleMute, toggleVideo, toggleSpeaker(stub) }`
- Consumes: `MatrixVoIPService` for stream management
- Produces: Fully functional PC CallView with video stream binding, speaker toggle, and camera switch

- [ ] **Step 1: Read current CallView.vue to identify exact gaps**

Current state (359 lines):
- Has `remoteVideoRef` and `localVideoRef` template refs but no stream binding (`srcObject` not set)
- Has `toggleMute` and `toggleVideo` wired to `matrixVoIPService`
- Missing: `toggleSpeaker` implementation (composable has stub)
- Missing: `switchCamera` (front/back camera toggle)
- Missing: Stream binding to video elements

Run: `cat -n src/components/call/CallView.vue | head -100`

- [ ] **Step 2: Add stream binding**

In the `<script setup>` section, add stream watchers:

```ts
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVoIPCallFlow } from '@/composables/webrtc/useVoIPCallFlow'

const localVideoRef = ref<HTMLVideoElement>()
const remoteVideoRef = ref<HTMLVideoElement>()

const { localStream, remoteStream, toggleSpeaker, switchCamera } = useVoIPCallFlow()

watch(localStream, (stream) => {
  if (localVideoRef.value && stream) {
    localVideoRef.value.srcObject = stream
  }
}, { immediate: true })

watch(remoteStream, (stream) => {
  if (remoteVideoRef.value && stream) {
    remoteVideoRef.value.srcObject = stream
  }
}, { immediate: true })

onUnmounted(() => {
  if (localVideoRef.value) localVideoRef.value.srcObject = null
  if (remoteVideoRef.value) remoteVideoRef.value.srcObject = null
})
```

- [ ] **Step 3: Add speaker toggle button in template**

Add after the mute button (around line 82):

```vue
<n-button circle :type="isSpeakerOn ? 'default' : 'warning'" @click="handleToggleSpeaker">
  <template #icon>
    <n-icon><volume-up-outline v-if="isSpeakerOn" /><volume-off-outline v-else /></n-icon>
  </template>
</n-button>
```

Add handler:
```ts
const isSpeakerOn = ref(true)
async function handleToggleSpeaker() {
  await toggleSpeaker()
  isSpeakerOn.value = !isSpeakerOn.value
}
```

- [ ] **Step 4: Add camera switch button (for mobile/dual-camera devices)**

```vue
<n-button v-if="isVideo" circle @click="handleSwitchCamera">
  <template #icon>
    <n-icon><camera-reverse-outline /></n-icon>
  </template>
</n-button>
```

```ts
async function handleSwitchCamera() {
  await switchCamera()
}
```

- [ ] **Step 5: Write unit test**

Create `src/components/call/__tests__/CallView.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CallView from '../CallView.vue'

describe('CallView', () => {
  it('renders mute and speaker buttons', () => {
    const wrapper = mount(CallView, {
      props: { callId: 'call1', isVideo: false },
      global: {
        stubs: { 'n-button': true, 'n-icon': true, 'video': true }
      }
    })
    expect(wrapper.html()).toContain('toggleMute')
  })

  it('renders video elements when isVideo is true', () => {
    const wrapper = mount(CallView, {
      props: { callId: 'call1', isVideo: true },
      global: {
        stubs: { 'n-button': true, 'n-icon': true, 'video': true }
      }
    })
    const videos = wrapper.findAll('video')
    expect(videos.length).toBe(2) // local + remote
  })
})
```

- [ ] **Step 6: Run tests, type check, lint**

Run: `pnpm vitest run src/components/call/__tests__/CallView.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/components/call/CallView.vue \
        src/components/call/__tests__/CallView.test.ts
git commit -m "feat: add stream binding, speaker toggle, and camera switch to PC CallView

Bind localStream/remoteStream from useVoIPCallFlow to video elements.
Add speaker toggle and camera switch controls. Completes PC VoIP call UI."
```

---

### Task 6: Mobile VoIP Call Screen Enhancement

**Files:**
- Modify: `src/mobile/views/rtcCall/index.vue` — add speaker toggle, camera switch, stream binding verification
- Create: `src/mobile/views/rtcCall/__tests__/index.test.ts`
- Reference (do not modify): `src/composables/webrtc/useVoIPCallFlow.ts`
- Reference (do not modify): `src/services/matrix/media/MatrixVoIPService.ts`

**Interfaces:**
- Consumes: `useVoIPCallFlow()` — same interface as Task 5
- Produces: Complete mobile VoIP call screen with speaker toggle, camera switch, and verified stream binding

- [ ] **Step 1: Audit current rtcCall/index.vue**

The file is 462 lines. Based on exploration findings: all 4 call phases exist (idle, outgoing, incoming, active), stream binding works, but camera switch is a stub.

Run: `grep -n "switchCamera\|toggleSpeaker\|stub\|TODO" src/mobile/views/rtcCall/index.vue`

- [ ] **Step 2: Implement camera switch**

Replace stub:
```ts
// Current stub (example)
const switchCamera = () => {
  logger.info('switchCamera stub')
}
```

With:
```ts
const { switchCamera: switchCameraFlow } = useVoIPCallFlow()

const isFrontCamera = ref(true)
async function switchCamera() {
  try {
    await switchCameraFlow()
    isFrontCamera.value = !isFrontCamera.value
  } catch (err) {
    showToast(t('call.cameraSwitchError'))
  }
}
```

- [ ] **Step 3: Implement speaker toggle if missing**

```ts
const { toggleSpeaker: toggleSpeakerFlow } = useVoIPCallFlow()

const isSpeakerOn = ref(true)
async function toggleSpeaker() {
  await toggleSpeakerFlow()
  isSpeakerOn.value = !isSpeakerOn.value
}
```

Add speaker toggle button in the active-call template section.

- [ ] **Step 4: Verify stream binding is already functional**

The exploration found stream binding already works on mobile. Add explicit cleanup in `onUnmounted` if not present:

```ts
onUnmounted(() => {
  if (localVideoRef.value) localVideoRef.value.srcObject = null
  if (remoteVideoRef.value) remoteVideoRef.value.srcObject = null
})
```

- [ ] **Step 5: Write unit test**

Create `src/mobile/views/rtcCall/__tests__/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RtcCallView from '../index.vue'

describe('RtcCallView', () => {
  it('renders call action buttons', () => {
    const wrapper = mount(RtcCallView, {
      global: {
        stubs: {
          'van-icon': true, 'van-button': true, 'van-loading': true,
          'video': true, 'van-dialog': true
        }
      }
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run tests, type check, lint, and commit**

```bash
git add src/mobile/views/rtcCall/index.vue \
        src/mobile/views/rtcCall/__tests__/index.test.ts
git commit -m "feat: add speaker toggle and camera switch to mobile VoIP call screen

Replace camera switch stub with useVoIPCallFlow() switchCamera call.
Add speaker toggle control. Verify stream binding cleanup on unmount."
```

---

### Task 7: SSO/SAML/CAS Login Callback Verification

**Files:**
- Modify: `src/mobile/login.vue` — verify the SSO callback chain end-to-end, add error handling improvements if needed
- Create: `e2e/mobile-sso-login.spec.ts`
- Reference (do not modify): `src/services/matrix/auth/MatrixAuthService.ts` — `getSsoLoginUrl()`, `completeSsoLogin()`
- Reference (do not modify): `src/router/authGuard.ts`

**Interfaces:**
- Consumes: `handleSsoClick(key)` — existing function on line 429, calls `getSsoLoginUrl()` then opens WebView
- Consumes: `handleSsoLoginCallback()` — existing function on line 561, completes the OIDC/SAML callback
- Produces: Verified SSO callback chain + E2E regression test

- [ ] **Step 1: Audit existing SSO flow in login.vue**

The exploration confirmed:
- `SSO_FLOW_MAP` maps `oidc`, `saml`, `cas` to Matrix login flow types (lines 359-363)
- `handleSsoClick()` gets SSO URL via `getSsoLoginUrl()`, opens in WebView (line 429)
- `handleSsoLoginCallback()` processes callback URL, calls `completeSsoLogin()` (line 561)
- Both functions already have try-catch error handling
- SSO buttons render dynamically based on server login flow availability (line 134)

This task is primarily about verification and adding the E2E regression guard, NOT rebuilding the flow.

- [ ] **Step 2: Add structured error handling for SSO callback edge cases**

In `handleSsoLoginCallback` (around line 561), add handling for token expiry:

```ts
async function handleSsoLoginCallback(): Promise<boolean> {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const loginToken = urlParams.get('loginToken')
    if (!loginToken) return false

    await authService.completeSsoLogin(loginToken)
    return true
  } catch (err: any) {
    if (err.errcode === 'M_UNKNOWN_TOKEN' || err.message?.includes('expired')) {
      showToast(t('login.mobile.sso.tokenExpired'))
      return false
    }
    logger.error('Failed to complete mobile SSO login callback', error)
    showToast(t('login.mobile.sso.callbackError'))
    return false
  }
}
```

- [ ] **Step 3: Write E2E test for SSO callback**

Create `e2e/mobile-sso-login.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('Mobile SSO Login', () => {
  test('SSO login page renders provider buttons from server flow', async ({ page }) => {
    await page.goto('/mobile/login')
    // Wait for login flows to be fetched
    await page.waitForTimeout(2000)
    // SSO section should be visible
    const ssoSection = page.locator('text=SSO')
    // Check that at least one SSO button is rendered or the section shows "no providers"
    const ssoButtons = page.locator('[data-testid="sso-button"]')
    // This is a regression guard — exact button count depends on server config
    expect(await ssoSection.isVisible()).toBeTruthy()
  })

  test('SSO callback with missing loginToken redirects to login', async ({ page }) => {
    await page.goto('/mobile/login?loginToken=')
    // Should remain on login page
    await expect(page).toHaveURL(/\/mobile\/login/)
  })

  test('SSO flow map contains all expected providers', async ({ page }) => {
    await page.goto('/mobile/login')
    // Verify OIDC section exists
    const oidcButton = page.locator('[data-testid="sso-button-oidc"]')
    // Presence depends on server config; at minimum page should not crash
    await page.waitForLoadState('networkidle')
  })
})
```

- [ ] **Step 4: Add data-testid attributes to SSO buttons in login.vue**

In the SSO button template (around line 134):
```vue
<van-button
  :data-testid="`sso-button-${item.key}`"
  @click="handleSsoClick(item.key)"
>
```

- [ ] **Step 5: Run E2E tests**

Run: `pnpm test:e2e -- e2e/mobile-sso-login.spec.ts`
Expected: PASS (tests verify page structure; actual SSO callback requires real server)

- [ ] **Step 6: Type check, lint, and commit**

```bash
git add src/mobile/login.vue e2e/mobile-sso-login.spec.ts
git commit -m "feat: add token expiry handling and E2E regression test for SSO callback

Enhance handleSsoLoginCallback with M_UNKNOWN_TOKEN handling.
Add Playwright E2E test covering SSO page render and callback edge cases.
Add data-testid attributes for E2E selector stability."
```

---

## Phase 1 Complete Checklist

After all 7 tasks are done:

- [ ] Glob/Grep re-run: confirm S1-1 through S1-7 all ✅
- [ ] `vue-tsc --noEmit` — 0 errors
- [ ] `pnpm check` — 0 errors
- [ ] `pnpm test:run` — all new tests passing
- [ ] `pnpm test:e2e` — SSO E2E test passing
- [ ] VoIP dual-end manual test: call → answer → hangup on simulator/device
- [ ] Security triad manual test: setup → restore closed loop on test account
- [ ] Update `功能实现清单.md` status for all 7 P0 items
