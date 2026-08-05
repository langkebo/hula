<template>
  <div class="flex flex-col flex-1 min-h-0">
    <!-- 头部 -->
    <ChatHeader />

    <!-- 加密不可用警告条：crypto 未初始化且当前房间为加密房间时显示 -->
    <div
      v-if="showCryptoWarning"
      class="crypto-unavailable-banner flex items-center gap-8px px-12px py-6px bg-[--tjg-color-warning-100] border-b border-[--tjg-color-warning-500] text-[var(--text-xs)] color-[--tjg-color-warning-500]">
      <svg class="size-14px flex-shrink-0">
        <use href="#remind"></use>
      </svg>
      <span class="flex-1 truncate">{{ t('chat.crypto_unavailable.message') }}</span>
    </div>

    <div class="flex-1 flex min-h-0">
      <div class="flex-1 min-h-0">
        <!-- bot用户时显示Bot组件 -->
        <template v-if="isBotUser">
          <Bot />
        </template>
        <n-split
          v-else
          direction="vertical"
          :resize-trigger-size="0"
          class="h-full"
          :min="0.55"
          :max="0.74"
          :default-size="0.74">
          <template #1>
            <ChatMain />
          </template>
          <template #2>
            <!-- 输入框和操作列表 -->
            <ChatFooter :detail-id="currentSession?.detailId" />
          </template>
        </n-split>
      </div>
      <!-- 右侧栏占位：群聊时预留宽度直至 Sidebar 挂载完成，随后由子组件控制宽度（含折叠） -->
      <ChatSidebar />
    </div>
  </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { UserType } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { useGlobalStore } from '@/stores/domains/widget/global'

const { t } = useI18n()
const globalStore = useGlobalStore()
const encryptionStore = useEncryptionStore()
const { currentSession } = storeToRefs(globalStore)

// 是否为bot用户
const isBotUser = computed(() => currentSession.value?.account === UserType.BOT)

// 加密不可用警告：crypto 初始化失败且当前房间为加密房间时显示
const showCryptoWarning = computed(() => {
  if (!encryptionStore.cryptoInitFailed) return false
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) return false
  return matrixClientService.isRoomEncrypted(roomId)
})

onMounted(() => {
  // 登录后检查 crypto 初始化状态（startClient 中 ensureCrypto 已完成）
  encryptionStore.loadCryptoInitStatus()
})
</script>
<style scoped lang="scss">
:deep(.n-split .n-split__resize-trigger) {
  height: 16px !important;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent !important;
  z-index: 998;
  position: relative;
  // 确保不干扰 ChatFooter 的顶部边框
  margin-top: -7px;

  // 主指示线（默认隐藏，hover 时显示）
  &::before {
    content: '';
    position: absolute;
    width: 40px;
    height: 3px;
    background: var(--tjg-text-tertiary);
    border-radius: 2px;
    opacity: 0;
    transition: all var(--tjg-motion-duration-normal) ease;
  }

  // 上下辅助线（默认隐藏，hover 时显示）
  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 1px;
    background: transparent;
    border-radius: 1px;
    transition: all var(--tjg-motion-duration-normal) ease;
    opacity: 0;
    box-shadow:
      0 -3px 0 0 color-mix(in srgb, var(--tjg-text-tertiary) 50%, transparent),
      0 3px 0 0 color-mix(in srgb, var(--tjg-text-tertiary) 50%, transparent);
    pointer-events: none;
  }

  // hover 状态 - 显示指示器
  &:hover {
    &::before {
      opacity: 0.8;
      transform: scaleY(1.2);
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 color-mix(in srgb, var(--tjg-text-tertiary) 80%, transparent),
        0 3px 0 0 color-mix(in srgb, var(--tjg-text-tertiary) 80%, transparent);
    }
  }

  // active/dragging 状态 - 显示高亮指示器
  &:active {
    &::before {
      opacity: 1;
      transform: scaleY(1.2);
      background: color-mix(in srgb, var(--tjg-color-primary-500) 80%, transparent);
    }

    &::after {
      opacity: 1;
      box-shadow:
        0 -3px 0 0 color-mix(in srgb, var(--tjg-color-primary-500) 80%, transparent),
        0 3px 0 0 color-mix(in srgb, var(--tjg-color-primary-500) 80%, transparent);
    }
  }
}
</style>
