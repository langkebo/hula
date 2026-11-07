<template>
  <!-- 编辑类：资料编辑走右栏抽屉 -->
  <n-drawer v-model:show="editInfo.show" placement="right" :width="420">
    <n-drawer-content :title="t('home.profile_edit.title')" closable>
      <n-flex :size="20" class="select-none" vertical>
        <!-- 头像 -->
        <n-flex justify="center">
          <n-popover trigger="hover" :delay="300" :duration="300" placement="bottom">
            <template #trigger>
              <div v-clickable class="avatar-wrapper relative" @click="openAvatarCropper">
                <n-avatar
                  :size="80"
                  round
                  v-bind="editInfo.content?.avatar ? { src: AvatarUtils.getAvatarUrl(editInfo.content.avatar) } : {}" />
                <div class="avatar-hover absolute size-full rounded-50% flex-center">
                  <span class="text-[var(--text-sm)] color-[--tjg-text-secondary]">
                    {{ t('home.profile_edit.avatar.change') }}
                  </span>
                </div>
              </div>
            </template>
            <p class="text-[var(--text-sm)] text-[--tjg-text-secondary] w-280px leading-5 p-4px">
              {{ t('home.profile_edit.avatar.tips') }}
            </p>
          </n-popover>
        </n-flex>
        <!-- 从头像库选择 -->
        <n-flex justify="center">
          <n-button text size="small" @click="showGallery = true">
            {{ t('home.profile_edit.avatar.choose_from_gallery') }}
          </n-button>
        </n-flex>
        <!-- 当前佩戴的徽章 -->
        <n-flex v-if="currentBadge" align="center" justify="center">
          <span class="text-[var(--text-sm)] text-[--tjg-text-secondary]">
            {{ t('home.profile_edit.badge.current') }}
          </span>
          <n-popover trigger="hover">
            <template #trigger>
              <img
                :src="currentBadge?.img"
                :alt="currentBadge?.describe || t('home.profile_edit.badge.image_alt')"
                class="size-22px" />
            </template>
            <span>{{ currentBadge?.describe }}</span>
          </n-popover>
        </n-flex>

        <!-- 昵称编辑输入框 -->
        <n-popover placement="top-start" trigger="click">
          <template #trigger>
            <n-input
              ref="inputInstRef"
              :count-graphemes="countGraphemes"
              v-bind="
                localUserInfo.name !== undefined ? { value: localUserInfo.name, defaultValue: localUserInfo.name } : {}
              "
              :maxlength="8"
              :passively-activated="true"
              class="rounded-[var(--tjg-radius-md)]"
              clearable
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              :allow-input="noSideSpace"
              :placeholder="t('home.profile_edit.form.nickname.placeholder')"
              show-count
              type="text"
              @update:value="localUserInfo.name = $event">
              <template #prefix>
                <span class="pr-6px text-[--tjg-text-tertiary]">
                  {{ t('home.profile_edit.form.nickname.label') }}
                </span>
              </template>
            </n-input>
          </template>
          <span>
            {{
              (editInfo.content.modifyNameChance ?? 0) < 0
                ? t('home.profile_edit.form.nickname.unlimited')
                : t('home.profile_edit.form.nickname.remaining', { count: editInfo.content.modifyNameChance ?? 0 })
            }}
          </span>
        </n-popover>

        <!-- 徽章列表  -->
        <n-flex :size="[56, 20]" align="center">
          <template v-for="item in editInfo.badgeList" :key="item.id">
            <div class="badge-item">
              <n-image
                :class="{ 'grayscale-0': item.obtain === IsYesEnum.YES }"
                :src="item.img"
                alt="badge"
                class="flex-center grayscale"
                width="100"
                height="100"
                preview-disabled
                round />
              <div class="tip">
                <template v-if="item.obtain === IsYesEnum.YES">
                  <n-button
                    class="text-[--tjg-text-inverse]"
                    v-if="item.wearing === IsYesEnum.NO"
                    type="primary"
                    @click="toggleWarningBadge(item)">
                    {{ t('home.profile_edit.badge.wear') }}
                  </n-button>
                </template>
                <n-popover trigger="hover">
                  <template #trigger>
                    <svg class="size-24px outline-none color-[--tjg-color-primary-500]">
                      <use href="#tips"></use>
                    </svg>
                  </template>
                  <span>{{ item.describe }}</span>
                </n-popover>
              </div>
            </div>
          </template>
        </n-flex>
      </n-flex>
      <template #footer>
        <div class="flex justify-end">
          <n-button
            class="text-[--tjg-text-inverse]"
            :disabled="editInfo.content.name === localUserInfo.name"
            type="primary"
            @click="saveEditInfo(localUserInfo as ModifyUserInfoType)">
            {{ t('home.profile_edit.actions.save') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
  <!-- 添加裁剪组件 -->
  <input
    ref="fileInput"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="handleFileChange" />
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
  <AvatarGallery v-model:show="showGallery" @select="handleGallerySelect" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import AvatarGallery from '@/components/common/AvatarGallery.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { countGraphemes } from '@/composables/common/useCommon'
import { useMitt } from '@/composables/common/useMitt'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { useAccount } from '@/composables/user/useAccount'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import { IsYesEnum, MittEnum } from '@/enums'
import { leftHook } from '@/layout/left/hook.ts'
import { useTypedI18n } from '@/plugins/i18n'
import { badgeService } from '@/services/notification/BadgeService'
import type { ModifyUserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { t } = useTypedI18n()
const { showFeedback } = useActionFeedback()
const { updateAvatar } = useAccount()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({})
const userStore = useUserStore()
const { addListener } = useTauriListener()
const loginHistoriesStore = useLoginHistoriesStore()
const { editInfo, currentBadge, updateCurrentUserCache, saveEditInfo, toggleWarningBadge } = leftHook()
// 使用自定义hook处理头像上传
const {
  localImageUrl,
  showCropper,
  showGallery,
  openAvatarCropper,
  handleFileChange,
  handleGallerySelect,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    // 更新 Matrix 头像 URL（mxc:// URI）
    await updateAvatar(mxcUrl)
    // 更新用户 store 中的头像
    if (userStore.matrixProfile) {
      userStore.matrixProfile.avatarUrl = mxcUrl
    }
    // 更新 userInfo.avatar（LeftAvatar 等主界面组件读取此字段）
    if (userStore.userInfo) {
      userStore.userInfo.avatar = mxcUrl
    }
    // 更新编辑信息
    editInfo.value.content.avatar = mxcUrl
    // 更新登录历史记录
    const historyItem = loginHistoriesStore.loginHistories.find((item) => item.uid === (userStore.userInfo?.uid ?? ''))
    if (historyItem) {
      historyItem.avatar = mxcUrl
    }
    // 更新缓存里面的用户信息
    updateCurrentUserCache('avatar', mxcUrl)
    // 清除旧头像的 URL 缓存，确保下次解析使用最新 mxcResolver
    AvatarUtils.clearCache()
    showFeedback(t('home.profile_edit.toast.avatar_update_success'), 'success')
  }
})

// 处理裁剪，调用hook中的方法
const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

/** 不允许输入空格 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

const openEditInfo = () => {
  editInfo.value.show = true
  editInfo.value.content = userStore.userInfo ?? {}
  // 兼容旧持久化数据：modifyNameChance 为 0 或 undefined 时，规范化为 -1（无限制）
  // 旧版本 initUserInfo 设置 modifyNameChance: 0 并被持久化到 localStorage，
  // 重启后加载的 0 会触发 saveEditInfo 的改名次数不足检查
  if (editInfo.value.content.modifyNameChance === undefined || editInfo.value.content.modifyNameChance === 0) {
    editInfo.value.content.modifyNameChance = -1
    if (userStore.userInfo) {
      userStore.userInfo.modifyNameChance = -1
    }
  }
  localUserInfo.value = { ...(userStore.userInfo ?? {}) }
  /** 获取徽章列表 */
  badgeService
    .getBadgeList()
    .then((res) => {
      editInfo.value.badgeList = res as typeof editInfo.value.badgeList
    })
    .catch(() => {
      // F-2 修复：徽章列表获取失败时静默降级为空列表，避免 unhandledrejection
      editInfo.value.badgeList = []
    })
}

onMounted(async () => {
  if (appWindow) {
    await addListener(
      appWindow.listen('open_edit_info', async () => {
        openEditInfo()
      }),
      'open_edit_info'
    )
  }
  useMitt.on(MittEnum.OPEN_EDIT_INFO, () => {
    useMitt.emit(MittEnum.CLOSE_INFO_SHOW)
    openEditInfo()
  })
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.badge-item {
  .tip {
    transition: opacity var(--tjg-motion-duration-xslow) ease-in-out;
    @apply absolute top-0 left-0 w-full h-full flex-center gap-4px z-999 opacity-0;
  }

  @apply bg-[--tjg-text-disabled] relative rounded-50% size-fit p-4px cursor-pointer;

  &:hover .tip {
    @apply opacity-100;
  }
}

.avatar-wrapper {
  cursor: pointer;

  .avatar-hover {
    opacity: 0;
    transition: opacity var(--tjg-motion-duration-xslow) ease-in-out;
    backdrop-filter: blur(var(--tjg-glass-blur-soft));
    -webkit-backdrop-filter: blur(var(--tjg-glass-blur-soft));
    /* 背景由头像自身提供，低性能设备只关闭模糊 */
    @include backdrop-blur-fallback;
    top: 0;
    left: 0;

    span {
      text-align: center;
    }
  }

  &:hover .avatar-hover {
    opacity: 1;
  }
}
</style>
