/**
 * 杂项域类型定义（AI / 文件元数据）
 * 注意：请使用TSDoc规范进行注释，以便在使用时能够获得良好提示。
 * @see TSDoc规范 https://tsdoc.org/
 */

/** AI模型 */
export type AIModel = {
  uid: string
  type: 'Ollama' | 'OpenAI'
  name: string
  value: string
  avatar: string
}

export type FilesMeta = {
  name: string
  path: string
  file_type: string
  mime_type: string
  exists: boolean
}[]
