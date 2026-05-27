<template>
  <n-modal
    v-model:show="show"
    class="h-fit w-380px"
    preset="card"
    :title="t('message.friend_verify.title')"
    :bordered="false"
    :closable="true"
    @after-leave="handleClose">
    <n-flex vertical justify="center" :size="20" class="p-10px">
      <n-flex align="center" justify="center" :size="20">
        <n-avatar round size="large" :src="avatarSrc" />
        <n-flex vertical :size="10">
          <p class="text-[--hula-text-primary]">{{ userInfo.name }}</p>
          <p class="text-(12px [--hula-text-primary])">
            {{ t('message.friend_verify.account', { account: userInfo.account }) }}
          </p>
        </n-flex>
      </n-flex>

      <n-input
        v-model:value="requestMsg"
        :allow-input="(value: string) => !value.startsWith(' ') && !value.endsWith(' ')"
        :autosize="requestMsgAutosize"
        :maxlength="60"
        :count-graphemes="countGraphemes"
        show-count
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        type="textarea"
        :placeholder="t('message.friend_verify.placeholder')" />

      <n-button class="mt-10px" color="var(--color-primary)" @click="addFriend">
        {{ t('message.friend_verify.send_btn') }}
      </n-button>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useFriends } from '@/composables/useFriends'
import { countGraphemes } from '@/hooks/useCommon'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStore = useUserStore()
const globalStore = useGlobalStore()

const show = computed({
  get: () => globalStore.addFriendModalInfo.show,
  set: (val) => {
    globalStore.addFriendModalInfo.show = val
  }
})

const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const { userInfo, avatarSrc, requestMsg, syncDefaultMessage, submitRequest } = useFriends({
  defaultRequestMessage: computed(() =>
    t('message.friend_verify.default_msg', { name: userStore.userInfo?.name ?? '' })
  )
})

const addFriend = async () => {
  const submitted = await submitRequest()
  if (!submitted) return
  showFeedback(t('message.friend_verify.toast_success'), 'success')
  handleClose()
}

const handleClose = () => {
  globalStore.closeAddFriendModal()
}

watch(show, (newVal) => {
  if (newVal) {
    syncDefaultMessage()
  }
})
</script>

<style scoped lang="scss"></style>
