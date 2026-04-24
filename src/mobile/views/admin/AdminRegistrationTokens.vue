<template>
  <mobile-layout :title="t('admin.registration_tokens')" show-back>
    <div class="mobile-admin-tokens">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group>
          <van-swipe-cell v-for="t_ in admin.tokens.value" :key="t_.token">
            <van-cell
              :title="t_.token"
              :label="formatToken(t_)" />
            <template #right>
              <van-button square type="danger" :text="t('admin.delete')" @click="handleDelete(t_.token)" />
            </template>
          </van-swipe-cell>
        </van-cell-group>
      </van-pull-refresh>

      <div class="add-section">
        <van-button type="primary" block :loading="admin.creating.value" @click="showCreateDialog = true">
          {{ t('admin.create_token') }}
        </van-button>
      </div>

      <van-dialog
        v-model:show="showCreateDialog"
        :title="t('admin.create_token')"
        show-cancel-button
        @confirm="handleCreate">
        <van-field v-model="newToken" :label="t('admin.token')" :placeholder="t('admin.token_placeholder')" />
        <van-field v-model="newUses" :label="t('admin.uses_allowed')" type="digit" />
        <van-field v-model="newExpiryDate" :label="t('admin.expiry_ms')" type="digit" :placeholder="t('admin.expiry_placeholder')" />
      </van-dialog>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminRegistrationTokens } from '@/composables/admin'
import type { RegistrationToken } from '@/services/matrix/admin/MatrixAdminService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminRegistrationTokens')
const { t } = useI18n()

const admin = useAdminRegistrationTokens()
const refreshing = ref(false)
const showCreateDialog = ref(false)
const newToken = ref('')
const newUses = ref('')
const newExpiryDate = ref('')

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadTokens()
  } catch (error) {
    logger.error('[MobileAdminRegistrationTokens] 加载失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const formatToken = (rt: RegistrationToken) => {
  const parts: string[] = []
  if (rt.usesAllowed !== undefined) parts.push(`${rt.completed}/${rt.usesAllowed}`)
  if (rt.pending) parts.push(`pending=${rt.pending}`)
  if (rt.expiryTime) parts.push(new Date(rt.expiryTime).toLocaleDateString())
  return parts.join(' · ') || '-'
}

const handleCreate = async () => {
  try {
    await admin.createToken({
      token: newToken.value.trim() || undefined,
      usesAllowed: newUses.value ? Number(newUses.value) : undefined,
      expiryTime: newExpiryDate.value ? Number(newExpiryDate.value) : undefined
    })
    showToast(t('admin.operation_success'))
    newToken.value = ''
    newUses.value = ''
    newExpiryDate.value = ''
  } catch (error) {
    logger.error('[MobileAdminRegistrationTokens] 创建失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleDelete = async (token: string) => {
  try {
    await admin.deleteToken(token)
    showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminRegistrationTokens] 删除失败:', error)
    showToast(t('admin.load_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-tokens {
  .add-section {
    padding: 16px;
  }
}
</style>
