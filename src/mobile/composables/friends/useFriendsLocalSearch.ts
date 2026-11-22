import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'

interface FriendsLocalSearchSource {
  specialContacts: Ref<MatrixContact[]>
  normalContacts: Ref<MatrixContact[]>
  blockedContacts: Ref<MatrixContact[]>
}

/**
 * 好友本地搜索：只过滤当前已加载的好友列表，不触发服务端请求。
 */
export function useFriendsLocalSearch({ specialContacts, normalContacts, blockedContacts }: FriendsLocalSearchSource) {
  const groupStore = useGroupStore()

  const localKeyword = ref('')
  const normalizedKeyword = computed(() => localKeyword.value.trim().toLowerCase())

  function matchesLocalKeyword(contact: MatrixContact): boolean {
    const keyword = normalizedKeyword.value
    if (!keyword) return true
    // 备注 > 昵称 > 账号/userId，外加群聊用户信息里的展示名，覆盖用户可见的检索维度
    return [
      contact.remark,
      contact.displayName,
      contact.account,
      contact.userId,
      groupStore.getUserInfo(contact.userId)?.name
    ].some((field) => typeof field === 'string' && field.toLowerCase().includes(keyword))
  }

  const filterContacts = (contacts: MatrixContact[]) =>
    normalizedKeyword.value ? contacts.filter(matchesLocalKeyword) : contacts

  const filteredSpecialContacts = computed(() => filterContacts(specialContacts.value))
  const filteredNormalContacts = computed(() => filterContacts(normalContacts.value))
  const filteredBlockedContacts = computed(() => filterContacts(blockedContacts.value))
  const filteredSpecialOnlineCount = computed(
    () => filteredSpecialContacts.value.filter((item) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const filteredNormalOnlineCount = computed(
    () => filteredNormalContacts.value.filter((item) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const isLocalSearchEmpty = computed(
    () =>
      Boolean(normalizedKeyword.value) &&
      filteredSpecialContacts.value.length === 0 &&
      filteredNormalContacts.value.length === 0 &&
      filteredBlockedContacts.value.length === 0
  )

  return {
    localKeyword,
    matchesLocalKeyword,
    filterContacts,
    filteredSpecialContacts,
    filteredNormalContacts,
    filteredBlockedContacts,
    filteredSpecialOnlineCount,
    filteredNormalOnlineCount,
    isLocalSearchEmpty
  }
}
