import { ref } from 'vue'

const defaultState = () => ({
  selectKey: 'chat',
  optionsList: [] as unknown[],
  report: [] as unknown[],
  activeBubble: '',
  handleMsgClick: () => undefined,
  handleConfirm: async () => undefined,
  handleItemType: () => [],
  handleCopy: async () => undefined,
  videoMenuList: [] as unknown[],
  getSelectedText: () => '',
  hasSelectedText: () => false,
  clearSelection: () => undefined,
  historyIndex: 0,
  tips: '',
  modalShow: false,
  specialMenuList: () => [],
  commonMenuList: [] as unknown[],
  scrollTop: -1,
  groupNicknameModalVisible: false,
  groupNicknameValue: '',
  groupNicknameError: '',
  groupNicknameSubmitting: false,
  handleGroupNicknameConfirm: async () => undefined
})

const internalState = {
  selectKey: ref(defaultState().selectKey),
  optionsList: ref(defaultState().optionsList),
  report: ref(defaultState().report),
  activeBubble: ref(defaultState().activeBubble),
  historyIndex: ref(defaultState().historyIndex),
  tips: ref(defaultState().tips),
  modalShow: ref(defaultState().modalShow),
  videoMenuList: ref(defaultState().videoMenuList),
  commonMenuList: ref(defaultState().commonMenuList),
  scrollTop: ref(defaultState().scrollTop),
  groupNicknameModalVisible: ref(defaultState().groupNicknameModalVisible),
  groupNicknameValue: ref(defaultState().groupNicknameValue),
  groupNicknameError: ref(defaultState().groupNicknameError),
  groupNicknameSubmitting: ref(defaultState().groupNicknameSubmitting)
}

export const resetChatMainMock = () => {
  const nextState = defaultState()
  internalState.selectKey.value = nextState.selectKey
  internalState.optionsList.value = nextState.optionsList
  internalState.report.value = nextState.report
  internalState.activeBubble.value = nextState.activeBubble
  internalState.historyIndex.value = nextState.historyIndex
  internalState.tips.value = nextState.tips
  internalState.modalShow.value = nextState.modalShow
  internalState.videoMenuList.value = nextState.videoMenuList
  internalState.commonMenuList.value = nextState.commonMenuList
  internalState.scrollTop.value = nextState.scrollTop
  internalState.groupNicknameModalVisible.value = nextState.groupNicknameModalVisible
  internalState.groupNicknameValue.value = nextState.groupNicknameValue
  internalState.groupNicknameError.value = nextState.groupNicknameError
  internalState.groupNicknameSubmitting.value = nextState.groupNicknameSubmitting
}

export const configureChatMainMock = (options: Partial<ReturnType<typeof defaultState>>) => {
  const nextState = { ...defaultState(), ...options }
  internalState.selectKey.value = nextState.selectKey
  internalState.optionsList.value = nextState.optionsList
  internalState.report.value = nextState.report
  internalState.activeBubble.value = nextState.activeBubble
  internalState.historyIndex.value = nextState.historyIndex
  internalState.tips.value = nextState.tips
  internalState.modalShow.value = nextState.modalShow
  internalState.videoMenuList.value = nextState.videoMenuList
  internalState.commonMenuList.value = nextState.commonMenuList
  internalState.scrollTop.value = nextState.scrollTop
  internalState.groupNicknameModalVisible.value = nextState.groupNicknameModalVisible
  internalState.groupNicknameValue.value = nextState.groupNicknameValue
  internalState.groupNicknameError.value = nextState.groupNicknameError
  internalState.groupNicknameSubmitting.value = nextState.groupNicknameSubmitting
}

export const chatMainInjectionKey = Symbol('storybook-chatMainInjectionKey')

export const useChatMain = () => ({
  selectKey: internalState.selectKey,
  optionsList: internalState.optionsList,
  report: internalState.report,
  activeBubble: internalState.activeBubble,
  handleMsgClick: defaultState().handleMsgClick,
  handleConfirm: defaultState().handleConfirm,
  handleItemType: defaultState().handleItemType,
  handleCopy: defaultState().handleCopy,
  videoMenuList: internalState.videoMenuList,
  getSelectedText: defaultState().getSelectedText,
  hasSelectedText: defaultState().hasSelectedText,
  clearSelection: defaultState().clearSelection,
  historyIndex: internalState.historyIndex,
  tips: internalState.tips,
  modalShow: internalState.modalShow,
  specialMenuList: defaultState().specialMenuList,
  commonMenuList: internalState.commonMenuList,
  scrollTop: internalState.scrollTop,
  groupNicknameModalVisible: internalState.groupNicknameModalVisible,
  groupNicknameValue: internalState.groupNicknameValue,
  groupNicknameError: internalState.groupNicknameError,
  groupNicknameSubmitting: internalState.groupNicknameSubmitting,
  handleGroupNicknameConfirm: defaultState().handleGroupNicknameConfirm
})
