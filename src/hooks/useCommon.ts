import GraphemeSplitter from 'grapheme-splitter'
import { useUserStore } from '@/stores/domains/user/user'
import { getEditorRange, getMessageContentType, triggerInputEvent } from './common/editorDomBasics'
import { useEditorDom } from './common/useEditorDom'
import { useEditorPaste } from './common/useEditorPaste'

const domParser = new DOMParser()

export interface SelectionRange {
  range: Range
  selection: Selection
}

/**
 * 返回dom指定id的文本
 * @param dom 指定dom
 * @param id 元素id
 */
export const parseInnerText = (dom: string, id: string): string | undefined => {
  const doc = domParser.parseFromString(dom, 'text/html')
  return doc.getElementById(id)?.innerText
}

const graphemeSplitter = new GraphemeSplitter()

/** 计算字符长度（grapheme cluster 计数） */
export const countGraphemes = (value: string) => graphemeSplitter.countGraphemes(value)

/** 常用工具类 */
export const useCommon = () => {
  const userStore = useUserStore()
  /** 当前登录用户的uid */
  const userUid = computed(() => userStore.userInfo?.uid ?? '')
  /** 回复消息 */
  const reply = ref({
    avatar: '',
    accountName: '',
    content: '',
    key: '' as string | number,
    imgCount: 0
  })

  // 编辑器 DOM 构造（抽离到 useEditorDom）
  const { insertNode, insertNodeAtRange } = useEditorDom({ reply })

  // 粘贴/文件处理（抽离到 useEditorPaste）
  const { saveCacheFile, imgPaste, FileOrVideoPaste, handleConfirmFiles, processFiles, handlePaste } = useEditorPaste({
    userUid,
    triggerInputEvent,
    insertNode
  })

  return {
    imgPaste,
    getEditorRange,
    getMessageContentType,
    insertNode,
    triggerInputEvent,
    handlePaste,
    FileOrVideoPaste,
    handleConfirmFiles,
    countGraphemes,
    insertNodeAtRange,
    reply,
    userUid,
    processFiles,
    saveCacheFile
  }
}
