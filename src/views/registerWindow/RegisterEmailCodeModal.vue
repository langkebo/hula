<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    class="rounded-8px"
    transform-origin="center"
    @update:show="emit('update:show', $event)">
    <div class="bg-[--tjg-surface-elevated] w-380px h-fit box-border flex flex-col">
      <MacCloseButton v-if="isMac()" class="z-999 absolute top-3px left-4px" @click="emit('update:show', false)" />

      <svg
        v-if="isWindows()"
        @click="emit('update:show', false)"
        class="w-12px h-12px ml-a mr-4px mt-4px cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <n-flex vertical class="w-full h-fit">
        <n-flex vertical :size="10" class="p-24px">
          <p class="text-(16px [--tjg-text-primary]) mb-10px">{{ t('auth.register.email_modal.title') }}</p>
          <p class="text-(12px [--tjg-text-tertiary]) leading-5 mb-10px">
            {{ t('auth.register.email_modal.desc', { email }) }}
          </p>

          <!-- PIN 输入框 -->
          <div class="mb-20px">
            <PinInput v-model="emailCode" @complete="emit('submit')" ref="pinInputRef" />
          </div>

          <n-button
            :loading="loading"
            :disabled="!isEmailCodeComplete"
            tertiary
            @click="emit('submit')"
            class="text-[--tjg-text-inverse] w-full gradient-button">
            {{ t('auth.register.actions.submit') }}
          </n-button>
        </n-flex>
      </n-flex>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PinInput from '@/components/atomic/PinInput.vue'
import MacCloseButton from '@/components/common/MacCloseButton.vue'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const props = defineProps<{
  show: boolean
  email: string
  loading: boolean
  code: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:code': [value: string]
  submit: []
}>()

const { t } = useI18n()

const pinInputRef = ref()

const emailCode = computed({
  get: () => props.code,
  set: (value: string) => emit('update:code', value)
})

const isEmailCodeComplete = computed(() => props.code.length === 6)

function focus() {
  pinInputRef.value?.focus()
}

defineExpose({ focus })
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
