<template>
  <n-modal v-model:show="editInfo.show" :mask-closable="false" class="rounded-8px" transform-origin="center">
    <div class="bg-[--bg-edit] w-480px h-fit box-border flex flex-col">
      <n-flex :size="6" vertical>
        <div
          v-if="isMac()"
          @click="editInfo.show = false"
          class="mac-close size-13px shadow-inner bg-[--hula-color-primary-500] rounded-50% mt-6px select-none absolute left-6px">
          <svg class="hidden size-7px color-[--hula-text-inverse] select-none absolute top-3px left-3px">
            <use href="#close"></use>
          </svg>
        </div>

        <n-flex class="text-[var(--text-sm)] text-[--hula-text-primary] select-none pt-6px" justify="center">
          {{ t('home.profile_edit.title') }}
        </n-flex>

        <svg
          v-if="isWindows()"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px"
          @click="editInfo.show = false">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--hula-border-default]"></span>
      </n-flex>
      <n-flex :size="20" class="p-22px select-none" vertical>
        <!-- 头像 -->
        <n-flex justify="center">
          <n-popover trigger="hover" :delay="300" :duration="300" placement="bottom">
            <template #trigger>
              <div class="avatar-wrapper relative" @click="openAvatarCropper">
                <n-avatar
                  :size="80"
                  :src="editInfo.content?.avatar ? AvatarUtils.getAvatarUrl(editInfo.content.avatar) : undefined"
                  round />
                <div class="avatar-hover absolute size-full rounded-50% flex-center">
                  <span class="text-[var(--text-sm)] color-[--hula-text-secondary]">
                    {{ t('home.profile_edit.avatar.change') }}
                  </span>
                </div>
              </div>
            </template>
            <p class="text-[var(--text-sm)] text-[--hula-text-secondary] w-280px leading-5 p-4px">
              {{ t('home.profile_edit.avatar.tips') }}
            </p>
          </n-popover>
        </n-flex>
        <!-- 当前佩戴的徽章 -->
        <n-flex v-if="currentBadge" align="center" justify="center">
          <span class="text-[var(--text-sm)] text-[--hula-text-secondary]">
            {{ t('home.profile_edit.badge.current') }}
          </span>
          <n-popover trigger="hover">
            <template #trigger>
              <img :src="currentBadge?.img" :alt="currentBadge?.describe || '徽章'" class="size-22px" />
            </template>
            <span>{{ currentBadge?.describe }}</span>
          </n-popover>
        </n-flex>

        <!-- 昵称编辑输入框 -->
        <n-popover placement="top-start" trigger="click">
          <template #trigger>
            <n-input
              ref="inputInstRef"
              v-model:value="localUserInfo.name"
              :count-graphemes="countGraphemes"
              :default-value="localUserInfo.name"
              :maxlength="8"
              :passively-activated="true"
              class="rounded-6px"
              clearable
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              :allow-input="noSideSpace"
              :placeholder="t('home.profile_edit.form.nickname.placeholder')"
              show-count
              type="text">
              <template #prefix>
                <span class="pr-6px text-[--hula-text-tertiary]">
                  {{ t('home.profile_edit.form.nickname.label') }}
                </span>
              </template>
            </n-input>
          </template>
          <span>
            {{ t('home.profile_edit.form.nickname.remaining', { count: editInfo.content.modifyNameChance || 0 }) }}
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
                    style="color: var(--hula-text-inverse)"
                    v-if="item.wearing === IsYesEnum.NO"
                    type="primary"
                    @click="toggleWarningBadge(item)">
                    {{ t('home.profile_edit.badge.wear') }}
                  </n-button>
                </template>
                <n-popover trigger="hover">
                  <template #trigger>
                    <svg class="size-24px outline-none">
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
      <n-flex class="p-12px" align="center" justify="center">
        <n-button
          style="color: var(--hula-text-inverse)"
          :disabled="editInfo.content.name === localUserInfo.name"
          type="primary"
          @click="saveEditInfo(localUserInfo as ModifyUserInfoType)">
          {{ t('home.profile_edit.actions.save') }}
        </n-button>
      </n-flex>
    </div>
  </n-modal>
  <!-- 添加裁剪组件 -->
  <input
    ref="fileInput"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    class="hidden"
    @change="handleFileChange" />
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { countGraphemes } from '@/composables/common/useCommon'
import { useMitt } from '@/composables/common/useMitt'
import { useTauriListener } from '@/composables/common/useTauriListener'
import { useAccount } from '@/composables/user/useAccount'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import { IsYesEnum, MittEnum } from '@/enums'
import { leftHook } from '@/layout/left/hook.ts'
import { badgeService } from '@/services/BadgeService'
import type { ModifyUserInfoType } from '@/services/types'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { updateAvatar } = useAccount()
const localUserInfo = ref<Partial<ModifyUserInfoType>>({})
const userStore = useUserStore()
const { addListener } = useTauriListener()
const loginHistoriesStore = useLoginHistoriesStore()
const { editInfo, currentBadge, updateCurrentUserCache, saveEditInfo, toggleWarningBadge } = leftHook()
// 使用自定义hook处理头像上传
const {
  fileInput,
  localImageUrl,
  showCropper,
  cropperRef,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    // 更新 Matrix 头像 URL（mxc:// URI）
    await updateAvatar(mxcUrl)
    // 更新用户 store 中的头像
    if (userStore.matrixProfile) {
      userStore.matrixProfile.avatarUrl = mxcUrl
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
  localUserInfo.value = { ...(userStore.userInfo ?? {}) }
  /** 获取徽章列表 */
  badgeService.getBadgeList().then((res) => {
    editInfo.value.badgeList = res as unknown as typeof editInfo.value.badgeList
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
.badge-item {
  .tip {
    transition: opacity 0.4s ease-in-out;
    @apply absolute top-0 left-0 w-full h-full flex-center gap-4px z-999 opacity-0;
  }

  @apply bg-[--hula-text-disabled] relative rounded-50% size-fit p-4px cursor-pointer;

  &:hover .tip {
    @apply opacity-100;
  }
}

.mac-close:hover {
  svg {
    display: block;
  }
}

.avatar-wrapper {
  cursor: pointer;

  .avatar-hover {
    opacity: 0;
    transition: opacity 0.4s ease-in-out;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
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
