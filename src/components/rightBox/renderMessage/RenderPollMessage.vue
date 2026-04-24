<template>
  <div class="poll-message">
    <div class="poll-header">
      <svg class="size-16px">
        <use href="#poll"></use>
      </svg>
      <span class="poll-title">{{ pollData.question }}</span>
    </div>

    <div class="poll-options">
      <div
        v-for="(option, index) in pollData.options"
        :key="index"
        class="poll-option"
        :class="{ selected: selectedOption === index, ended: isEnded }"
        @click="handleVote(index)">
        <div class="option-content">
          <n-radio v-if="!isEnded" :checked="selectedOption === index" :disabled="isEnded || hasVoted" />
          <span class="option-text">{{ option.text }}</span>
          <span v-if="hasVoted || isEnded" class="option-count">
            {{ option.count || 0 }} ({{ getPercentage(option.count) }}%)
          </span>
        </div>
        <div v-if="hasVoted || isEnded" class="option-progress" :style="{ width: getPercentage(option.count) + '%' }" />
      </div>
    </div>

    <div class="poll-footer">
      <span class="total-votes">{{ pollData.totalVotes || 0 }} {{ t('poll.votes') }}</span>
      <span v-if="isEnded" class="ended-badge">{{ t('poll.ended') }}</span>
      <span v-else-if="endTime" class="end-time">{{ t('poll.ends_at') }} {{ formatTime(endTime) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { formatTimestamp } from '@/utils/ComputedTime'

interface PollOption {
  text: string
  count?: number
}

interface PollData {
  question: string
  options: PollOption[]
  totalVotes?: number
  isEnded?: boolean
  endTime?: number
}

const props = defineProps<{
  pollData: PollData
  hasVoted?: boolean
  votedOption?: number
  isEnded?: boolean
  endTime?: number
}>()

const emit = defineEmits<(e: 'vote', optionIndex: number) => void>()

const { t } = useI18n()
const selectedOption = ref<number | undefined>(props.votedOption)

const getPercentage = (count?: number): number => {
  if (!count || !props.pollData.totalVotes) return 0
  return Math.round((count / props.pollData.totalVotes) * 100)
}

const formatTime = (timestamp: number) => {
  return formatTimestamp(timestamp, false)
}

const handleVote = (index: number) => {
  if (props.hasVoted || props.isEnded) return
  selectedOption.value = index
  emit('vote', index)
}
</script>

<style scoped lang="scss">
.poll-message {
  @apply flex flex-col gap-12px p-12px bg-[--right-chat-reply-color] rounded-8px min-w-200px max-w-320px;
}

.poll-header {
  @apply flex items-center gap-8px;
}

.poll-title {
  @apply text-14px font-medium;
}

.poll-options {
  @apply flex flex-col gap-8px;
}

.poll-option {
  @apply relative flex items-center p-8px rounded-6px cursor-pointer transition-all overflow-hidden;

  &:not(.ended):hover {
    background: var(--emoji-hover);
  }

  &.selected {
    background: var(--color-primary-light);
  }
}

.option-content {
  @apply flex items-center gap-8px w-full z-1;
}

.option-text {
  @apply text-14px flex-1;
}

.option-count {
  @apply text-12px color-[--color-text-tertiary];
}

.option-progress {
  @apply absolute inset-y-0 left-0 bg-[--color-primary]20 rounded-6px transition-all;
}

.poll-footer {
  @apply flex items-center justify-between text-12px color-[--color-text-tertiary];
}

.ended-badge {
  @apply px-6px py-2px bg-[--color-text-tertiary]20 rounded-4px;
}
</style>
