<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('setting.encryption.device_verify_dialog.title')"
    class="w-[500px] rounded-12px overflow-hidden shadow-lg"
    :mask-closable="false">
    <n-spin :show="loading">
      <div class="px-24px py-20px">
        <!-- 步骤条引导 -->
        <n-steps :current="currentStepIndex" class="mb-32px" size="small">
          <n-step :title="t('setting.encryption.device_verify_dialog.step_intro')" />
          <n-step :title="t('setting.encryption.device_verify_dialog.step_verify')" />
          <n-step :title="t('setting.encryption.device_verify_dialog.step_result')" />
        </n-steps>

        <!-- Step: Intro -->
        <DeviceVerifyIntroStep
          v-if="step === 'intro'"
          :inbound-request="props.inboundRequest ?? null"
          :device-id="targetDeviceId"
          :device-name="props.deviceName"
          :pending-verifications="pendingVerifications"
          :target-user-id="targetUserId"
          :is-other-user="isVerifyingOtherUser"
          :device-options="targetDevices"
          v-model:selected-device-id="selectedDeviceId"
          @cancel="handleCancel"
          @view-pending="openPendingList"
          @decline="handleDecline"
          @start="startVerification"
          @accept-pending="acceptPendingRequest"
          @decline-pending="declinePendingRequest" />

        <!-- Step: Pending List -->
        <DeviceVerifyPendingStep
          v-else-if="step === 'pendingList'"
          :pending-verifications="pendingVerifications"
          @back="backToIntro"
          @refresh="loadPendingVerifications"
          @accept-pending="acceptPendingRequest"
          @decline-pending="declinePendingRequest" />

        <!-- Step: Show SAS（emoji 比对；无 SAS 时只显示等待，绝不退回指纹） -->
        <DeviceVerifySasStep
          v-else-if="step === 'showKey'"
          :sas-ready="sasReady"
          :emojis="sasEmojis"
          :decimal="sasDecimal"
          :sas-confirmed="sasConfirmed"
          v-model:show-cancel-reason="showCancelReason"
          v-model:cancel-reason="cancelReason"
          @update:sas-confirmed="sasConfirmed = $event"
          @hide-cancel-reason="hideCancelReason"
          @cancel-with-reason="handleCancelWithReason"
          @reject="handleReject"
          @confirm="handleConfirm" />

        <!-- Step: Success / Rejected -->
        <DeviceVerifyResultStep
          v-else-if="step === 'success' || step === 'rejected'"
          :status="step === 'success' ? 'success' : 'rejected'"
          @close="handleClose" />
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NSpin } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type DeviceVerifyDialogProps, useDeviceVerifyDialog } from '@/composables/encryption/useDeviceVerifyDialog'
import type { VerificationTransaction } from '@/services/matrix/crypto/MatrixVerificationService'
import DeviceVerifyIntroStep from './DeviceVerifyIntroStep.vue'
import DeviceVerifyPendingStep from './DeviceVerifyPendingStep.vue'
import DeviceVerifyResultStep from './DeviceVerifyResultStep.vue'
import DeviceVerifySasStep from './DeviceVerifySasStep.vue'

defineOptions({
  name: 'DeviceVerifyDialog'
})

const props = defineProps<{
  show: boolean
  /** 目标用户 MXID；缺省表示验证本账号的其它设备 */
  userId?: string | undefined
  deviceId?: string | undefined
  deviceName?: string | undefined
  inboundRequest?: VerificationTransaction | null
  initialMode?: 'sas'
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const { t } = useI18n()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

/**
 * composable 的入参类型 `DeviceVerifyDialogProps` 将可选属性声明为不接受 `undefined`
 * （`userId?: string`），而本组件的 defineProps 经 Volar 归一化后其值类型含 `undefined`，
 * 两者在 exactOptionalPropertyTypes 下不兼容。此处在调用点构造一个带 getter 的适配对象：
 * getter 保持对 props 的响应式追踪，`?? 默认值` 与原逻辑（`props.x || 兜底`）语义等价。
 */
const dialogProps: DeviceVerifyDialogProps = {
  get show() {
    return props.show
  },
  get userId() {
    return props.userId ?? ''
  },
  get deviceId() {
    return props.deviceId ?? ''
  },
  get deviceName() {
    return props.deviceName ?? ''
  },
  get inboundRequest() {
    return props.inboundRequest ?? null
  },
  get initialMode() {
    return props.initialMode ?? 'sas'
  }
}

const {
  // state (exposed on vm for tests)
  step,
  loading,
  sasReady,
  sasEmojis,
  sasDecimal,
  sasConfirmed,
  cancelReason,
  showCancelReason,
  pendingVerifications,
  targetUserId,
  targetDeviceId,
  targetDevices,
  // getters
  currentStepIndex,
  isVerifyingOtherUser,
  // actions
  loadPendingVerifications,
  openPendingList,
  backToIntro,
  acceptPendingRequest,
  declinePendingRequest,
  handleDecline,
  handleCancel,
  handleCancelWithReason,
  hideCancelReason,
  handleClose,
  startVerification,
  handleConfirm,
  handleReject
} = useDeviceVerifyDialog({ props: dialogProps, emit, visible })

/**
 * 设备选择框的双向绑定。
 *
 * 不直接对解构出来的 ref 写 `v-model:selected-device-id="targetDeviceId"`：
 * 解构结果在编译期无法被判定为 ref，依赖运行期 `_isRef` 探测才能正确写入。
 * 显式 writable computed 把赋值收敛到一处，行为更确定。
 */
const selectedDeviceId = computed({
  get: () => targetDeviceId.value,
  set: (value: string) => {
    targetDeviceId.value = value
  }
})
</script>
