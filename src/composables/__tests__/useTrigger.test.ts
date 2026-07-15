import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useTrigger } from '@/composables/common/useTrigger'

const buildHarness = () => {
  const personList = ref<unknown[]>([{ uid: 'a' }])
  const groupedAIModels = ref<unknown[]>([])
  const topicList = ref<unknown[]>([{ id: 't' }])
  const ait = ref(false)
  const aitKey = ref('')
  const aiDialogVisible = ref(false)
  const aiKeyword = ref('')
  const topicDialogVisible = ref(false)
  const topicKeyword = ref('')

  const trigger = useTrigger(
    personList,
    groupedAIModels,
    topicList,
    ait,
    aitKey,
    aiDialogVisible,
    aiKeyword,
    topicDialogVisible,
    topicKeyword
  )

  return {
    trigger,
    state: { personList, ait, aitKey, topicDialogVisible, topicKeyword, aiKeyword, aiDialogVisible }
  }
}

describe('useTrigger', () => {
  describe('handleTrigger - mention (@)', () => {
    it('detects @ trigger and sets ait flag with keyword', async () => {
      const { trigger, state } = buildHarness()
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const ctx = { range, selection: {} as Selection, keyword: '' }
      const fired = await trigger.handleTrigger('hello @al', 9, ctx)
      expect(state.ait.value).toBe(true)
      expect(state.aitKey.value).toBe('al')
      expect(fired).toBe(true)
    })

    it('does not trigger when there is no @ before cursor', async () => {
      const { trigger, state } = buildHarness()
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const ctx = { range, selection: {} as Selection, keyword: '' }
      const fired = await trigger.handleTrigger('plain text', 5, ctx)
      expect(state.ait.value).toBe(false)
      expect(fired).toBe(false)
    })

    it('resets state when person list is empty', async () => {
      const personList = ref<unknown[]>([])
      const groupedAIModels = ref<unknown[]>([])
      const topicList = ref<unknown[]>([])
      const ait = ref(false)
      const aitKey = ref('')
      const aiDialogVisible = ref(false)
      const aiKeyword = ref('')
      const topicDialogVisible = ref(false)
      const topicKeyword = ref('')
      const trigger = useTrigger(
        personList,
        groupedAIModels,
        topicList,
        ait,
        aitKey,
        aiDialogVisible,
        aiKeyword,
        topicDialogVisible,
        topicKeyword
      )
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const fired = await trigger.handleTrigger('hi @x', 5, { range, selection: {} as Selection, keyword: '' })
      expect(fired).toBe(false)
      expect(ait.value).toBe(false)
    })
  })

  describe('handleTrigger - topic (#)', () => {
    it('detects # trigger and sets topic dialog with keyword', async () => {
      const { trigger, state } = buildHarness()
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const ctx = { range, selection: {} as Selection, keyword: '' }
      const fired = await trigger.handleTrigger('hi #vue', 7, ctx)
      expect(state.topicDialogVisible.value).toBe(true)
      expect(state.topicKeyword.value).toBe('vue')
      expect(fired).toBe(true)
    })
  })

  describe('resetAllStates', () => {
    it('clears every reactive flag and keyword', () => {
      const { trigger, state } = buildHarness()
      state.ait.value = true
      state.aitKey.value = 'k'
      state.aiDialogVisible.value = true
      state.aiKeyword.value = 'k'
      state.topicDialogVisible.value = true
      state.topicKeyword.value = 'k'
      trigger.resetAllStates()
      expect(state.ait.value).toBe(false)
      expect(state.aitKey.value).toBe('')
      expect(state.aiDialogVisible.value).toBe(false)
      expect(state.aiKeyword.value).toBe('')
      expect(state.topicDialogVisible.value).toBe(false)
      expect(state.topicKeyword.value).toBe('')
    })
  })

  describe('handleTrigger - invalid input', () => {
    it('returns false for empty text', async () => {
      const { trigger } = buildHarness()
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const fired = await trigger.handleTrigger('', 0, { range, selection: {} as Selection, keyword: '' })
      expect(fired).toBe(false)
    })

    it('returns false for negative cursor position', async () => {
      const { trigger } = buildHarness()
      const range = { getBoundingClientRect: () => ({ x: 0, y: 0 }) } as unknown as Range
      const fired = await trigger.handleTrigger('hi @x', -1, { range, selection: {} as Selection, keyword: '' })
      expect(fired).toBe(false)
    })
  })
})
