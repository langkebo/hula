import { ref } from 'vue'

export const useMsgInput = () => ({
  inputKeyDown: () => undefined,
  handleAit: () => undefined,
  handleAI: () => undefined,
  handleInput: () => undefined,
  msgInput: ref(''),
  send: async () => undefined,
  sendLocationDirect: async () => undefined,
  sendFilesDirect: async () => undefined,
  sendVoiceDirect: async () => undefined,
  sendEmojiDirect: async () => undefined,
  personList: ref([]),
  disabledSend: ref(false),
  ait: ref(false),
  aiDialogVisible: ref(false),
  selectedAIKey: ref(''),
  chatKey: ref('Enter'),
  menuList: [],
  selectedAitKey: ref(''),
  groupedAIModels: ref([]),
  updateSelectionRange: () => undefined,
  focusOn: (element?: HTMLElement) => {
    element?.focus?.()
  },
  getCursorSelectionRange: () => null
})
