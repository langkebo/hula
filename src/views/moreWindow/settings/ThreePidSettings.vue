<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.threepid.title') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex class="mb-12px" justify="space-between" align="center">
          <span class="text-(12px --color-text-tertiary)">{{ t('setting.threepid.bound_accounts') }}</span>
          <n-button size="small" type="primary" @click="showAddDialog = true">
            {{ t('setting.threepid.add') }}
          </n-button>
        </n-flex>

        <n-spin :show="loading">
          <div v-if="threePids.length === 0" class="text-(12px --color-text-tertiary) text-center py-20px">
            {{ t('setting.threepid.no_bound') }}
          </div>

          <template v-else>
            <template v-for="(pid, index) in threePids" :key="`${pid.medium}-${pid.address}`">
              <n-flex align="center" justify="space-between" class="py-12px">
                <n-flex align="center" :size="12">
                  <svg class="size-20px">
                    <use :href="pid.medium === 'email' ? '#email' : '#phone'"></use>
                  </svg>
                  <n-flex vertical :size="2">
                    <span class="text-14px">{{ pid.address }}</span>
                    <span class="text-(12px --color-text-tertiary)">{{ pid.medium === 'email' ? t('setting.threepid.email') : t('setting.threepid.phone') }}</span>
                  </n-flex>
                </n-flex>
                <n-flex :size="8">
                  <n-button size="tiny" @click="handleUnbind(pid)">
                    {{ t('setting.threepid.unbind') }}
                  </n-button>
                  <n-button size="tiny" type="error" @click="handleDelete(pid)">
                    {{ t('setting.threepid.delete') }}
                  </n-button>
                </n-flex>
              </n-flex>
              <span v-if="index < threePids.length - 1" class="w-full h-1px bg-[--line-color]"></span>
            </template>
          </template>
        </n-spin>
      </n-flex>
    </n-flex>

    <n-modal v-model:show="showAddDialog" :title="t('setting.threepid.add_title')" preset="dialog">
      <n-form ref="formRef" :model="addForm" :rules="formRules" label-placement="left" label-width="80">
        <n-form-item :label="t('setting.threepid.type')" path="medium">
          <n-select v-model:value="addForm.medium" :options="mediumOptions" />
        </n-form-item>
        <n-form-item v-if="addForm.medium === 'email'" :label="t('setting.threepid.email')" path="address">
          <n-input v-model:value="addForm.address" :placeholder="t('setting.threepid.email_placeholder')" />
        </n-form-item>
        <n-form-item v-if="addForm.medium === 'msisdn'" :label="t('setting.threepid.phone')" path="address">
          <n-input v-model:value="addForm.address" :placeholder="t('setting.threepid.phone_placeholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showAddDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="submitting" @click="handleAddThreePid">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { matrixAccountService } from '@/services/matrix'

const { t } = useI18n()
const message = useMessage()

interface ThreePid {
  medium: string
  address: string
  validated_at?: number
  added_at?: number
}

const loading = ref(false)
const threePids = ref<ThreePid[]>([])
const showAddDialog = ref(false)
const submitting = ref(false)
const formRef = ref()

const addForm = ref({
  medium: 'email',
  address: ''
})

const mediumOptions = [
  { label: t('setting.threepid.email'), value: 'email' },
  { label: t('setting.threepid.phone'), value: 'msisdn' }
]

const formRules = {
  address: { required: true, message: t('setting.threepid.address_required'), trigger: 'blur' }
}

async function loadThreePids() {
  loading.value = true
  try {
    const result = await matrixAccountService.getThreePids()
    threePids.value = (result as { threepids?: ThreePid[] }).threepids ?? []
  } catch {
    message.error(t('setting.threepid.load_failed'))
  } finally {
    loading.value = false
  }
}

async function handleAddThreePid() {
  submitting.value = true
  try {
    const clientSecret = crypto.randomUUID()
    if (addForm.value.medium === 'email') {
      const { sid } = await matrixAccountService.requestEmailTokenFor3Pid(addForm.value.address, clientSecret)
      await matrixAccountService.addThreePid(sid, clientSecret)
      message.success(t('setting.threepid.add_success'))
    } else {
      message.info(t('setting.threepid.phone_verify_pending'))
    }
    showAddDialog.value = false
    addForm.value.address = ''
    await loadThreePids()
  } catch {
    message.error(t('setting.threepid.add_failed'))
  } finally {
    submitting.value = false
  }
}

async function handleUnbind(pid: ThreePid) {
  try {
    await matrixAccountService.unbindThreePid(pid.medium, pid.address)
    message.success(t('setting.threepid.unbind_success'))
    await loadThreePids()
  } catch {
    message.error(t('setting.threepid.unbind_failed'))
  }
}

async function handleDelete(pid: ThreePid) {
  try {
    await matrixAccountService.deleteThreePid(pid.medium, pid.address)
    message.success(t('setting.threepid.delete_success'))
    await loadThreePids()
  } catch {
    message.error(t('setting.threepid.delete_failed'))
  }
}

onMounted(() => {
  loadThreePids()
})
</script>
