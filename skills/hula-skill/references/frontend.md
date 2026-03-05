# Frontend Guide (hula)

## Stack

- Vue 3 Composition API with `<script setup>`
- Vite 7 + TypeScript 5.8
- Pinia 3 for global state
- UnoCSS for utility styling
- Naive UI (desktop), Vant (mobile)
- vue-i18n for translations
- matrix-js-sdk ^37.0.0 for Matrix protocol

## File Placement

| Type | Desktop | Mobile |
|------|---------|--------|
| Views | `src/views/` | `src/mobile/views/` |
| Components | `src/components/` | `src/mobile/components/` |
| Layouts | `src/layout/` | `src/mobile/layout/` |
| Routes | `src/router/index.ts` | Same file (platform detection) |

### Services

| Directory | Purpose |
|-----------|---------|
| `src/services/matrix/` | Matrix SDK wrappers (25+ services) |
| `src/services/offline/` | Offline support |
| `src/services/openclaw/` | OpenClaw AI integration |

### Other Directories

| Directory | Purpose |
|-----------|---------|
| `src/stores/` | Pinia stores |
| `src/hooks/` | Vue composables |
| `src/utils/` | Utility functions |
| `src/enums/` | TypeScript enums |
| `src/types/` | TypeScript type definitions |

## Matrix Services Architecture

hula wraps matrix-js-sdk through service classes in `src/services/matrix/`:

```
src/services/matrix/
├── MatrixClientService.ts      # Client lifecycle
├── MatrixRoomService.ts        # Room management
├── MatrixEventService.ts       # Event/message handling
├── MatrixCryptoService.ts      # Crypto operations
├── MatrixMediaService.ts       # Media upload/download
├── MatrixAccountService.ts     # Account management
├── MatrixReactionService.ts    # Message reactions
├── MatrixForwardService.ts     # Message forwarding
├── MatrixSearchService.ts      # Search functionality
├── MatrixReceiptService.ts     # Read receipts
├── MatrixTypingService.ts      # Typing indicators
├── MatrixMessageRelationService.ts  # Edits/replies/threads
├── MatrixThreadService.ts      # Thread management
├── MatrixEncryptionService.ts  # E2EE management
├── MatrixMultimediaService.ts  # Voice/image/video
├── MatrixSpaceService.ts       # Spaces
├── MatrixVoIPService.ts        # Voice/video calls
├── MatrixNotificationService.ts # Push rules
├── MatrixLocationService.ts    # Location sharing
├── MatrixPollService.ts        # Polls
├── MatrixFriendService.ts      # Friend system
├── MatrixDirectMessageService.ts # DM management
├── MatrixVoiceService.ts       # Voice messages
├── MatrixModerationService.ts  # Moderation
├── MatrixPushService.ts        # Push notifications
├── MatrixQuotaService.ts       # Quota management
└── index.ts                    # Exports
```

### Service Pattern

```typescript
class MatrixXxxService {
  private client: MatrixClient | null = null

  setClient(client: MatrixClient | null): void {
    this.client = client
  }

  async someMethod(): Promise<Result> {
    const client = this.getClient()
    return client.xxx()
  }

  private getClient(): MatrixClient {
    if (!this.client) {
      throw new Error('[MatrixXxx] 客户端未初始化')
    }
    return this.client
  }
}

export const matrixXxxService = new MatrixXxxService()
```

## Pinia Patterns

### Setup Store Style

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'

export const useUserStore = defineStore(StoresEnum.USER, () => {
  const userInfo = ref<UserInfo | null>(null)
  const isLoading = ref(false)

  const isLoggedIn = computed(() => !!userInfo.value)

  async function login(username: string, password: string): Promise<boolean> {
    isLoading.value = true
    try {
      const result = await matrixClientService.login(username, password)
      if (result.success) {
        userInfo.value = { userId: result.userId! }
        return true
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    userInfo,
    isLoading,
    isLoggedIn,
    login
  }
})
```

### Using Stores in Components

```typescript
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const { userInfo, isLoading } = storeToRefs(userStore)
const { login } = userStore
```

## Component Structure

```vue
<template>
  <div class="component-name">
    <!-- Template content -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

defineOptions({
  name: 'ComponentName'
})

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send', message: string): void
}>()

const loading = ref(false)
const message = ref('')

const displayName = computed(() => props.roomId)

function handleSubmit(): void {
  emit('send', message.value)
}

onMounted(() => {
  // Initialization
})
</script>

<style scoped>
/* Styles */
</style>
```

## Platform Detection

```typescript
import { computed } from 'vue'

export function usePlatform() {
  const isDesktop = computed(() => window.__TAURI__ !== undefined)
  const isMobile = computed(() => !isDesktop.value && /Mobi|Android/i.test(navigator.userAgent))

  return {
    isDesktop,
    isMobile,
    platform: isDesktop.value ? 'desktop' : 'mobile'
  }
}
```

## Styling

- Prefer UnoCSS utilities for simple styling.
- Use `src/styles/scss/global/variable.scss` for shared tokens.
- Consume tokens via `bg-[--token]`, `text-[--token]`, `border-[--token]`.

## Routing

Routes are defined in `src/router/index.ts`. Use platform detection for conditional rendering:

```typescript
{
  path: '/settings',
  component: () => import('@/views/settingsWindow/SettingsDialog.vue')
}
```

## i18n

Add new strings under `locales/` and reference via `t(...)`:

```typescript
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const label = t('settings.title')
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.vue` |
| Services | camelCase | `matrixClientService.ts` |
| Stores | camelCase | `user.ts` |
| Types | PascalCase | `UserInfo` |
| Enums | PascalCase | `StoresEnum` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Private members | Underscore prefix | `_client` |

## Error Handling

```typescript
async function handleSendMessage(): Promise<void> {
  try {
    loading.value = true
    await matrixEventService.sendMessage(roomId.value, message.value)
    message.value = ''
  } catch (error) {
    toast.error('发送失败，请稍后重试')
    console.error('[ChatView] 发送消息错误:', error)
  } finally {
    loading.value = false
  }
}
```

## Common Hooks

| Hook | Purpose |
|------|---------|
| `useLogin()` | Login flow |
| `useMessage()` | Message handling |
| `useChatMain()` | Chat view logic |
| `useFileUploadQueue()` | File uploads |
| `useDownload()` | File downloads |
| `useNetworkStatus()` | Network state |
| `useOnlineStatus()` | User presence |
| `usePlatform()` | Platform detection |
