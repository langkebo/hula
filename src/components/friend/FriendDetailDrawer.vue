<template>
  <n-drawer v-model:show="visible" :width="400" placement="right">
    <n-drawer-content :title="t('friend.detail.title')" closable>
      <n-spin :show="loading">
        <n-flex v-if="userInfo" vertical :size="16">
          <n-flex vertical align="center" :size="12">
            <n-avatar :size="80" :src="userInfo.avatar" round />
            <n-flex vertical align="center" :size="4">
              <span class="text-16px font-semibold">{{ userInfo.name }}</span>
              <span class="text-12px text-gray-500">@{{ userInfo.account }}</span>
            </n-flex>
          </n-flex>

          <n-divider />

          <n-flex vertical :size="8">
            <n-flex align="center" justify="space-between">
              <span class="text-14px text-gray-600">{{ t('friend.detail.status') }}</span>
              <n-tag :type="userInfo.online ? 'success' : 'default'" size="small">
                {{ userInfo.online ? t('friend.detail.online') : t('friend.detail.offline') }}
              </n-tag>
            </n-flex>
          </n-flex>

          <n-divider />

          <n-flex :size="8">
            <n-button type="primary" block @click="handleSendMessage">
              {{ t('friend.detail.sendMessage') }}
            </n-button>
            <n-button block @click="handleViewProfile">
              {{ t('friend.detail.viewProfile') }}
            </n-button>
          </n-flex>
        </n-flex>

        <n-empty v-else :description="t('friend.detail.notFound')" />
      </n-spin>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/domains/user/user'

const props = defineProps<{
  show: boolean
  userId: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:userId': [value: string]
}>()

const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()

const visible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const loading = ref(false)
const userInfo = ref<{ name: string; account: string; avatar: string; online: boolean } | null>(null)

const loadUserInfo = async () => {
  if (!props.userId) return

  loading.value = true
  try {
    userInfo.value = {
      name: 'User Name',
      account: props.userId,
      avatar: '',
      online: false
    }
  } catch (error) {
    userInfo.value = null
  } finally {
    loading.value = false
  }
}

const handleSendMessage = () => {
  if (!props.userId) return
  router.push(`/message/${props.userId}`)
  visible.value = false
}

const handleViewProfile = () => {
  if (!props.userId) return
  router.push(`/profile/${props.userId}`)
  visible.value = false
}

watch(() => props.userId, loadUserInfo, { immediate: true })
</script>
