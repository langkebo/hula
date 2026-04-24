import { describe, it, expect } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { UserItem } from '@/services/types.ts'
import { useMentionState } from '../useMentionState'

const makeUser = (overrides: Partial<UserItem> & { uid: string }): UserItem =>
  ({
    uid: overrides.uid,
    name: overrides.name ?? '',
    avatar: '',
    myName: overrides.myName,
    account: '',
    activeStatus: 1
  }) as unknown as UserItem

describe('useMentionState', () => {
  it('personList excludes the current user', () => {
    const users = ref<UserItem[]>([makeUser({ uid: '1', name: 'Alice' }), makeUser({ uid: '2', name: 'Bob' })])
    const { personList } = useMentionState(users, ref('1'), ref(false))
    expect(personList.value.map((u) => u.uid)).toEqual(['2'])
  })

  it('personList filters by aitKey prefix against name', () => {
    const users = ref<UserItem[]>([
      makeUser({ uid: '1', name: 'Alice' }),
      makeUser({ uid: '2', name: 'Bob' }),
      makeUser({ uid: '3', name: 'Albert' })
    ])
    const { personList, aitKey } = useMentionState(users, ref('999'), ref(false))
    aitKey.value = 'Al'
    expect(personList.value.map((u) => u.uid)).toEqual(['1', '3'])
  })

  it('personList prefers myName over name when matching', () => {
    const users = ref<UserItem[]>([
      makeUser({ uid: '1', name: 'Alice', myName: 'Zed' }),
      makeUser({ uid: '2', name: 'Bob' })
    ])
    const { personList, aitKey } = useMentionState(users, ref('999'), ref(false))
    aitKey.value = 'Ze'
    expect(personList.value.map((u) => u.uid)).toEqual(['1'])
  })

  it('personList ignores aitKey when isChinese is true (IME composing)', () => {
    const users = ref<UserItem[]>([makeUser({ uid: '1', name: 'Alice' }), makeUser({ uid: '2', name: 'Bob' })])
    const isChinese = ref(true)
    const { personList, aitKey } = useMentionState(users, ref('999'), isChinese)
    aitKey.value = 'Zz'
    expect(personList.value.map((u) => u.uid)).toEqual(['1', '2'])
  })

  it('selectedAitKey initializes to first candidate uid', () => {
    const users = ref<UserItem[]>([makeUser({ uid: '1', name: 'Alice' }), makeUser({ uid: '2', name: 'Bob' })])
    const { selectedAitKey } = useMentionState(users, ref('999'), ref(false))
    expect(selectedAitKey.value).toBe('1')
  })

  it('selectedAitKey realigns to first candidate when ait closes', async () => {
    const users = ref<UserItem[]>([makeUser({ uid: '1', name: 'Alice' }), makeUser({ uid: '2', name: 'Bob' })])
    const { ait, selectedAitKey } = useMentionState(users, ref('999'), ref(false))
    selectedAitKey.value = '2'
    ait.value = true
    await nextTick()
    ait.value = false
    await nextTick()
    expect(selectedAitKey.value).toBe('1')
  })

  it('works with a ComputedRef user source', () => {
    const base = ref<UserItem[]>([makeUser({ uid: '1', name: 'Alice' })])
    const source = computed(() => base.value)
    const { personList } = useMentionState(source, ref('999'), ref(false))
    expect(personList.value.map((u) => u.uid)).toEqual(['1'])
  })

  it('ait flag toggles independently of state', () => {
    const users = ref<UserItem[]>([])
    const { ait } = useMentionState(users, ref('1'), ref(false))
    expect(ait.value).toBe(false)
    ait.value = true
    expect(ait.value).toBe(true)
  })
})
