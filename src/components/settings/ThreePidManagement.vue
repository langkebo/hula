<template>
  <n-card title="联系方式管理" :bordered="false">
    <template #header-extra>
      <n-tag :type="hasUnverified ? 'warning' : 'success'">
        {{ threepids.length }} 个
      </n-tag>
    </template>

    <n-space vertical :size="16">
      <n-alert type="info">
        绑定邮箱和手机号可以帮助您找回密码，并让其他用户更容易找到您。
      </n-alert>

      <n-tabs type="line">
        <n-tab-pane name="email" tab="邮箱">
          <n-list v-if="emails.length > 0" bordered>
            <n-list-item v-for="email in emails" :key="email.address">
              <n-thing :title="email.address">
                <template #description>
                  <n-text depth="3">
                    {{ email.validated_at ? `已验证 (${formatTime(email.validated_at)})` : '待验证' }}
                  </n-text>
                </template>
              </n-thing>
              <template #suffix>
                <n-button size="small" @click="handleRemoveEmail(email.address)" :loading="loading">
                  移除
                </n-button>
              </template>
            </n-list-item>
          </n-list>

          <n-empty v-else description="暂无绑定邮箱" />

          <n-button type="primary" block class="mt-16px" @click="showAddEmailDialog = true">
            添加邮箱
          </n-button>
        </n-tab-pane>

        <n-tab-pane name="phone" tab="手机">
          <n-list v-if="phones.length > 0" bordered>
            <n-list-item v-for="phone in phones" :key="phone.address">
              <n-thing :title="phone.address">
                <template #description>
                  <n-text depth="3">
                    {{ phone.validated_at ? `已验证 (${formatTime(phone.validated_at)})` : '待验证' }}
                  </n-text>
                </template>
              </n-thing>
              <template #suffix>
                <n-button size="small" @click="handleRemovePhone(phone.address)" :loading="loading">
                  移除
                </n-button>
              </template>
            </n-list-item>
          </n-list>

          <n-empty v-else description="暂无绑定手机" />

          <n-button type="primary" block class="mt-16px" @click="showAddPhoneDialog = true">
            添加手机
          </n-button>
        </n-tab-pane>
      </n-tabs>
    </n-space>
  </n-card>

  <n-modal v-model:show="showAddEmailDialog" preset="card" title="添加邮箱" style="width: 400px">
    <n-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-placement="top">
      <n-form-item label="邮箱地址" path="email">
        <n-input v-model:value="emailForm.email" placeholder="请输入邮箱地址" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showAddEmailDialog = false">取消</n-button>
        <n-button type="primary" @click="handleAddEmail" :loading="loading">
          发送验证邮件
        </n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showAddPhoneDialog" preset="card" title="添加手机" style="width: 400px">
    <n-form ref="phoneFormRef" :model="phoneForm" :rules="phoneRules" label-placement="top">
      <n-form-item label="手机号码" path="phone">
        <n-input v-model:value="phoneForm.phone" placeholder="请输入手机号码" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="showAddPhoneDialog = false">取消</n-button>
        <n-button type="primary" @click="handleAddPhone" :loading="loading">
          发送验证短信
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMessage, type FormRules } from 'naive-ui'
import matrixAccountService from '@/services/matrix/MatrixAccountService'

const message = useMessage()

interface Threepid {
  medium: string
  address: string
  validated_at: number
  added_at: number
}

const threepids = ref<Threepid[]>([])
const loading = ref(false)
const showAddEmailDialog = ref(false)
const showAddPhoneDialog = ref(false)

const emailForm = ref({ email: '' })
const phoneForm = ref({ phone: '' })

const emailRules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email' as const, message: '请输入有效的邮箱地址', trigger: 'blur' }
  ]
}

const phoneRules = {
  phone: [
    { required: true, message: '请输入手机号码', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号码', trigger: 'blur' }
  ]
}

const emails = computed(() => threepids.value.filter((t) => t.medium === 'email'))
const phones = computed(() => threepids.value.filter((t) => t.medium === 'msisdn'))
const hasUnverified = computed(() => threepids.value.some((t) => !t.validated_at))

onMounted(async () => {
  await loadThreepids()
})

async function loadThreepids(): Promise<void> {
  loading.value = true

  try {
    const result = await matrixAccountService.getThreePids()
    threepids.value = result.threepids || []
  } catch (error) {
    message.error(`加载联系方式失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function handleAddEmail(): Promise<void> {
  if (!emailForm.value.email) return

  loading.value = true

  try {
    await matrixAccountService.addThreePid({
      medium: 'email',
      address: emailForm.value.email
    })

    message.success('验证邮件已发送，请查收')
    showAddEmailDialog.value = false
    emailForm.value.email = ''
    await loadThreepids()
  } catch (error) {
    message.error(`添加邮箱失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function handleAddPhone(): Promise<void> {
  if (!phoneForm.value.phone) return

  loading.value = true

  try {
    await matrixAccountService.addThreePid({
      medium: 'msisdn',
      address: phoneForm.value.phone
    })

    message.success('验证短信已发送，请查收')
    showAddPhoneDialog.value = false
    phoneForm.value.phone = ''
    await loadThreepids()
  } catch (error) {
    message.error(`添加手机失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function handleRemoveEmail(address: string): Promise<void> {
  loading.value = true

  try {
    await matrixAccountService.deleteThreePid({
      medium: 'email',
      address
    })

    message.success('邮箱已移除')
    await loadThreepids()
  } catch (error) {
    message.error(`移除邮箱失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function handleRemovePhone(address: string): Promise<void> {
  loading.value = true

  try {
    await matrixAccountService.deleteThreePid({
      medium: 'msisdn',
      address
    })

    message.success('手机已移除')
    await loadThreepids()
  } catch (error) {
    message.error(`移除手机失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    loading.value = false
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.mt-16px {
  margin-top: 16px;
}
</style>
