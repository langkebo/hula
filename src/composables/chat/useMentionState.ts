import { type ComputedRef, computed, type Ref, ref, watchEffect } from 'vue'
import type { UserItem } from '@/services/types.ts'

export interface MentionState {
  /** 弹窗是否展示 */
  ait: Ref<boolean>
  /** 当前 `@` 后用户输入的关键字（由上层在 compositionend / trigger 中写入） */
  aitKey: Ref<string>
  /** 根据 `aitKey` 过滤出的候选人列表，已排除当前登录用户 */
  personList: ComputedRef<UserItem[]>
  /** 当前高亮的候选人 uid */
  selectedAitKey: Ref<string | null>
}

/**
 * `@` 提及弹窗状态的独立 hook。
 *
 * 输入：群成员列表、当前登录用户 uid、是否正在拼音输入。
 * 输出：弹窗开关 `ait`、关键字 `aitKey`、候选列表 `personList`、当前高亮 `selectedAitKey`。
 *
 * 内部用 `watchEffect` 保证弹窗关闭后 `selectedAitKey` 跟随候选列表首项回位，
 * 与原 `useMsgInput.ts` 行为保持一致。
 */
export function useMentionState(
  userList: Ref<UserItem[]> | ComputedRef<UserItem[]>,
  currentUserId: Ref<string | number | undefined>,
  isChinese: Ref<boolean>
): MentionState {
  const ait = ref(false)
  const aitKey = ref('')

  const personList = computed<UserItem[]>(() => {
    if (aitKey.value && !isChinese.value) {
      return userList.value.filter((user) => {
        const displayName = user.myName || user.name
        return displayName?.startsWith(aitKey.value) && user.uid !== currentUserId.value
      })
    }
    return userList.value.filter((user) => user.uid !== currentUserId.value)
  })

  const selectedAitKey = ref<string | null>(personList.value[0]?.uid ?? null)

  watchEffect(() => {
    if (!ait.value && personList.value.length > 0) {
      selectedAitKey.value = personList.value[0]?.uid ?? null
    }
  })

  return { ait, aitKey, personList, selectedAitKey }
}
