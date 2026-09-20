<template>
  <div class="user-identity" :class="{ 'user-identity--interactive': interactive }">
    <TjgAvatar
      v-if="showAvatar"
      :src="avatarUrl"
      :name="displayName"
      :size="avatarSize"
      class="user-identity__avatar" />
    <div class="user-identity__info">
      <div class="user-identity__primary">
        <span class="user-identity__name" :title="primaryText">{{ primaryText }}</span>
        <FederationBadge
          v-if="showFederation && serverName"
          :is-local="!isFederated"
          size="xs"
          :label="isFederated ? t('friend.federated_user') : t('friend.local_user')"
          :title="serverName" />
      </div>
      <MxidText
        v-if="showMxid && mxid"
        :mxid="mxid"
        :show-full="showFullMxid"
        is-mono
        :max-length="mxidMaxLength"
        class="user-identity__mxid" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FederationBadge from '@/components/atomic/FederationBadge.vue'
import MxidText from '@/components/atomic/MxidText.vue'
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
import { extractServerName, sameHomeserver, toLocalpart } from '@/utils/userIdentity'

const props = withDefaults(
  defineProps<{
    /** 显示名称（优先于 mxid 的 localpart） */
    displayName?: string
    /** 完整 MXID */
    mxid?: string | null
    /** 头像 URL */
    avatarUrl?: string | null
    /** 本机 homeserver domain，用于联邦判定 */
    localServer?: string
    /** 是否显示头像 */
    showAvatar?: boolean
    /** 是否显示联邦标识 */
    showFederation?: boolean
    /** 是否显示次级 MXID */
    showMxid?: boolean
    /** 是否显示完整 MXID（否则仅 localpart） */
    showFullMxid?: boolean
    /** MXID 最大显示长度 */
    mxidMaxLength?: number
    /** 头像尺寸（px） */
    avatarSize?: number
    /** 是否可交互（hover 高亮） */
    interactive?: boolean
  }>(),
  {
    displayName: '',
    mxid: null,
    avatarUrl: null,
    localServer: '',
    showAvatar: true,
    showFederation: true,
    showMxid: true,
    showFullMxid: false,
    mxidMaxLength: 20,
    avatarSize: 36,
    interactive: false
  }
)

const { t } = useI18n()

/** 服务器名称（从 mxid 提取） */
const serverName = computed(() => {
  if (!props.mxid) return ''
  return extractServerName(props.mxid) || ''
})

/** 是否联邦用户（mxid 服务器 ≠ 本机服务器） */
const isFederated = computed(() => {
  if (!props.mxid || !props.localServer) return false
  return !sameHomeserver(props.mxid, props.localServer)
})

/**
 * 主显示文本：优先 displayName，其次 mxid localpart
 */
const primaryText = computed(() => {
  if (props.displayName) return props.displayName
  if (props.mxid) return toLocalpart(props.mxid)
  return ''
})
</script>

<style scoped lang="scss">
/* ==================== 联邦身份组合展示单元 ====================
 * §2.1 — UserIdentity：头像 + 主标识 + 次级 MXID + 联邦 chip
 * 单一事实源：MXID 解析走 @/utils/userIdentity，禁止组件内自行 split
 * ==================================================== */
.user-identity {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.user-identity--interactive {
  cursor: pointer;
  &:hover {
    opacity: 0.85;
  }
}

.user-identity__avatar {
  flex-shrink: 0;
}

.user-identity__info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
  min-width: 0;
}

.user-identity__primary {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.user-identity__name {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-identity__mxid {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-identity-mxid-color);
  line-height: 1.2;
}
</style>
