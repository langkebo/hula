<template>
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <ActionBar :max-w="false" :shrink="false" proxy />

    <n-flex vertical :size="22" class="p-20px">
      <n-flex justify="center" class="w-full pt-12px" data-tauri-drag-region>
        <n-avatar
          class="welcome size-80px rounded-50% border-(2px solid #fff) dark:border-(2px solid #606060)"
          :color="themes.content === ThemeEnum.DARK ? '#282828' : '#fff'"
          :fallback-src="themes.content === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          src="" />
      </n-flex>

      <n-flex class="ma text-center h-full w-300px" vertical :size="16">
        <n-input
          size="large"
          v-model:value="homeserverUrl"
          type="text"
          placeholder="Homeserver URL (e.g., https://matrix.org)"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #prefix>
            <svg class="w-18px h-18px color-#505050 dark:color-#909090">
              <use href="#server"></use>
            </svg>
          </template>
        </n-input>

        <n-input
          size="large"
          v-model:value="username"
          type="text"
          placeholder="Username"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #prefix>
            <svg class="w-18px h-18px color-#505050 dark:color-#909090">
              <use href="#user"></use>
            </svg>
          </template>
        </n-input>

        <n-input
          size="large"
          show-password-on="click"
          v-model:value="password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Password"
          clearable>
          <template #prefix>
            <svg class="w-18px h-18px color-#505050 dark:color-#909090">
              <use href="#lock"></use>
            </svg>
          </template>
        </n-input>

        <n-flex align="center" justify="center" :size="6">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-#909090 cursor-default lh-14px agreement">
            <span>I agree to the </span>
            <span class="color-#13987f cursor-pointer" @click.stop="openServiceAgreement">
              Terms of Service
            </span>
            <span> and </span>
            <span class="color-#13987f cursor-pointer" @click.stop="openPrivacyAgreement">
              Privacy Policy
            </span>
          </div>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: #fff"
          class="gradient-button w-full mt-8px mb-10px"
          @click="handleLogin">
          <span>{{ loading ? 'Logging in...' : 'Login' }}</span>
        </n-button>

        <n-alert v-if="errorMessage" type="error" :bordered="false" class="text-left">
          {{ errorMessage }}
        </n-alert>
      </n-flex>
    </n-flex>

    <div class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full px-20px pb-20px">
      <div class="color-#13987f cursor-pointer justify-self-end text-right" @click="showServerDiscovery = true">
        Server Discovery
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070 justify-self-center"></div>
      <div class="color-#13987f cursor-pointer justify-self-start text-left" @click="showSettings = true">
        Settings
      </div>
    </div>

    <n-modal v-model:show="showServerDiscovery" preset="card" title="Server Discovery" :style="{ width: '400px' }">
      <n-flex vertical :size="12">
        <p class="text-14px color-#909090">
          Enter your Matrix ID or homeserver address to discover the server.
        </p>
        <n-input
          v-model:value="discoveryInput"
          placeholder="e.g., @user:matrix.org or matrix.org"
          clearable />
        <n-button @click="discoverServer" :loading="discovering">
          Discover
        </n-button>
        <n-alert v-if="discoveryResult" :type="discoverySuccess ? 'success' : 'error'">
          {{ discoveryResult }}
        </n-alert>
      </n-flex>
    </n-modal>

    <n-modal v-model:show="showSettings" preset="card" title="Login Settings" :style="{ width: '400px' }">
      <n-flex vertical :size="12">
        <n-form-item label="Device Name">
          <n-input v-model:value="deviceName" placeholder="HuLa Client" clearable />
        </n-form-item>
        <n-form-item label="Identity Server">
          <n-input v-model:value="identityServerUrl" placeholder="https://vector.im" clearable />
        </n-form-item>
        <n-checkbox v-model:checked="enableE2EE">
          Enable End-to-End Encryption (default)
        </n-checkbox>
      </n-flex>
    </n-modal>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useMatrixStore } from '@/stores/matrix'
import { useRoomStore } from '@/stores/room'
import { useSettingStore } from '@/stores/setting.ts'
import { useUserStore } from '@/stores/user.ts'
import { ThemeEnum, SexEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow.ts'
import ActionBar from '@/components/common/ActionBar.vue'
import { info, error } from '@tauri-apps/plugin-log'

const router = useRouter()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const matrixStore = useMatrixStore()
const roomStore = useRoomStore()
const userStore = useUserStore()
const { createWebviewWindow } = useWindow()

const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))

const homeserverUrl = ref('https://matrix.org')
const identityServerUrl = ref('https://vector.im')
const username = ref('')
const password = ref('')
const deviceName = ref('HuLa Client')
const protocol = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const showServerDiscovery = ref(false)
const showSettings = ref(false)
const discoveryInput = ref('')
const discovering = ref(false)
const discoveryResult = ref('')
const discoverySuccess = ref(false)
const enableE2EE = ref(true)

const loginDisabled = computed(() => {
  return !username.value || !password.value || !homeserverUrl.value || !protocol.value || loading.value
})

async function handleLogin(): Promise<void> {
  if (loginDisabled.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await matrixStore.initialize({
      homeserverUrl: homeserverUrl.value,
      identityServerUrl: identityServerUrl.value
    })

    const success = await matrixStore.login(username.value, password.value, deviceName.value)

    if (success) {
      userStore.userInfo = {
        uid: matrixStore.userId ?? '',
        name: username.value,
        account: username.value,
        email: '',
        avatar: '',
        modifyNameChance: 0,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: 'PC',
        resume: ''
      }

      roomStore.setupEventListeners()
      await roomStore.loadRooms()

      await info(`[MatrixLogin] Login successful: ${matrixStore.userId}`)
      router.push('/main')
    } else {
      errorMessage.value = 'Login failed. Please check your credentials.'
    }
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during login.'
    await error(`[MatrixLogin] Login error: ${err}`)
  } finally {
    loading.value = false
  }
}

async function discoverServer(): Promise<void> {
  if (!discoveryInput.value) return

  discovering.value = true
  discoveryResult.value = ''
  discoverySuccess.value = false

  try {
    let serverName = discoveryInput.value
    if (serverName.startsWith('@')) {
      const parts = serverName.split(':')
      if (parts.length > 1) {
        serverName = parts[1]
      }
    }
    serverName = serverName.replace(/^https?:\/\//, '')

    const wellKnownUrl = `https://${serverName}/.well-known/matrix/client`
    const response = await fetch(wellKnownUrl)
    const data = await response.json()

    if (data['m.homeserver']) {
      homeserverUrl.value = data['m.homeserver'].base_url
      discoveryResult.value = `Found homeserver: ${homeserverUrl.value}`
      discoverySuccess.value = true
    } else {
      discoveryResult.value = 'No homeserver found in well-known data.'
    }

    if (data['m.identity_server']) {
      identityServerUrl.value = data['m.identity_server'].base_url
    }
  } catch (err) {
    discoveryResult.value = `Discovery failed: ${err}`
  } finally {
    discovering.value = false
  }
}

function openServiceAgreement(): void {
  createWebviewWindow('Terms of Service', 'terms', 600, 600)
}

function openPrivacyAgreement(): void {
  createWebviewWindow('Privacy Policy', 'privacy', 600, 600)
}
</script>

<style scoped>
.login-box {
  background: var(--bg-color);
}

.gradient-button {
  background: linear-gradient(90deg, #13987f 0%, #1db88a 100%);
  border: none;
}

.gradient-button:hover {
  background: linear-gradient(90deg, #0f7a66 0%, #1a9e78 100%);
}

.gradient-button:disabled {
  background: linear-gradient(90deg, #909090 0%, #a0a0a0 100%);
}
</style>
