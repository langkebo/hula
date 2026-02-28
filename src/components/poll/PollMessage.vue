<template>
  <div class="poll-message">
    <div class="poll-header">
      <n-icon size="18" color="#13987f">
        <svg><use href="#poll" /></svg>
      </n-icon>
      <span class="poll-question">{{ poll.question }}</span>
    </div>

    <div class="poll-options">
      <div
        v-for="(option, index) in poll.options"
        :key="index"
        class="poll-option"
        :class="{
          selected: selectedOptions.includes(index),
          winner: isEnded && winningOptions.includes(index)
        }"
        @click="handleSelectOption(index)">
        <div class="option-content">
          <n-checkbox
            v-if="poll.allowMultiple"
            :checked="selectedOptions.includes(index)"
            :disabled="isEnded || hasVoted"
            @update:checked="handleSelectOption(index)" />
          <n-radio
            v-else
            :checked="selectedOptions.includes(index)"
            :disabled="isEnded || hasVoted"
            @update:checked="handleSelectOption(index)" />
          <span class="option-text">{{ option.text }}</span>
        </div>

        <div v-if="showResults" class="option-result">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${getOptionPercentage(index)}%` }" />
          </div>
          <span class="vote-count">{{ option.votes || 0 }} ({{ getOptionPercentage(index).toFixed(1) }}%)</span>
        </div>
      </div>
    </div>

    <div class="poll-footer">
      <n-flex align="center" justify="space-between">
        <span class="vote-info">
          {{ t('poll.message.votes', { count: totalVotes }) }}
          <template v-if="poll.isAnonymous">· {{ t('poll.message.anonymous') }}</template>
        </span>
        <span v-if="poll.deadline" class="deadline">
          {{ isEnded ? t('poll.message.ended') : formatDeadline(poll.deadline) }}
        </span>
      </n-flex>

      <n-flex v-if="!hasVoted && !isEnded" :size="8" class="mt-8px">
        <n-button type="primary" size="small" :disabled="selectedOptions.length === 0" @click="handleVote">
          {{ t('poll.message.vote') }}
        </n-button>
      </n-flex>

      <n-flex v-if="isEnded" :size="8" class="mt-8px">
        <n-tag type="success" size="small">
          {{ t('poll.message.ended') }}
        </n-tag>
      </n-flex>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixPollService } from '@/services/matrix/MatrixPollService'
import dayjs from 'dayjs'

const { t } = useI18n()

interface PollOption {
  text: string
  votes?: number
}

interface PollData {
  pollId: string
  question: string
  options: PollOption[]
  isAnonymous: boolean
  allowMultiple: boolean
  deadline?: number
  ended?: boolean
}

const props = defineProps<{
  poll: PollData
  roomId: string
}>()

const emit = defineEmits<(e: 'voted') => void>()

const selectedOptions = ref<number[]>([])
const hasVoted = ref(false)
const showResults = ref(false)

const isEnded = computed(() => {
  if (props.poll.ended) return true
  if (props.poll.deadline && props.poll.deadline < Date.now()) return true
  return false
})

const totalVotes = computed(() => {
  return props.poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0)
})

const winningOptions = computed(() => {
  if (!isEnded.value || totalVotes.value === 0) return []

  const maxVotes = Math.max(...props.poll.options.map((o) => o.votes || 0))
  return props.poll.options.map((o, i) => (o.votes === maxVotes ? i : -1)).filter((i) => i >= 0)
})

const getOptionPercentage = (index: number) => {
  if (totalVotes.value === 0) return 0
  const votes = props.poll.options[index]?.votes || 0
  return (votes / totalVotes.value) * 100
}

const formatDeadline = (timestamp: number) => {
  const diff = timestamp - Date.now()
  if (diff < 60000) return t('poll.message.soon')
  if (diff < 3600000) return t('poll.message.minutes', { n: Math.ceil(diff / 60000) })
  if (diff < 86400000) return t('poll.message.hours', { n: Math.ceil(diff / 3600000) })
  return dayjs(timestamp).format('MM-DD HH:mm')
}

const handleSelectOption = (index: number) => {
  if (isEnded.value || hasVoted.value) return

  if (props.poll.allowMultiple) {
    const idx = selectedOptions.value.indexOf(index)
    if (idx >= 0) {
      selectedOptions.value.splice(idx, 1)
    } else {
      selectedOptions.value.push(index)
    }
  } else {
    selectedOptions.value = [index]
  }
}

const handleVote = async () => {
  if (selectedOptions.value.length === 0) return

  try {
    const optionId = selectedOptions.value[0].toString()
    await matrixPollService.vote(props.roomId, props.poll.pollId, optionId)

    hasVoted.value = true
    showResults.value = true
    window.$message.success(t('poll.message.vote_success'))
    emit('voted')
  } catch (err) {
    window.$message.error(t('poll.message.vote_error'))
  }
}

onMounted(() => {
  if (isEnded.value || hasVoted.value) {
    showResults.value = true
  }
})
</script>

<style scoped lang="scss">
.poll-message {
  padding: 12px;
  background: var(--bg-color);
  border-radius: 12px;
  min-width: 280px;
  max-width: 400px;
}

.poll-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;

  .poll-question {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poll-option {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.selected):not(.winner) {
    border-color: var(--primary-color);
  }

  &.selected {
    border-color: var(--primary-color);
    background: rgba(19, 152, 127, 0.1);
  }

  &.winner {
    border-color: #f0a020;
    background: rgba(240, 160, 32, 0.1);
  }
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;

  .option-text {
    font-size: 13px;
  }
}

.option-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;

  .progress-fill {
    height: 100%;
    background: var(--primary-color);
    border-radius: 2px;
    transition: width 0.3s;
  }
}

.vote-count {
  font-size: 12px;
  color: var(--text-color-3);
  white-space: nowrap;
}

.poll-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);

  .vote-info {
    font-size: 12px;
    color: var(--text-color-3);
  }

  .deadline {
    font-size: 12px;
    color: var(--text-color-3);
  }
}
</style>
