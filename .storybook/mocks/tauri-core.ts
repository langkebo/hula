export const invoke = async (_command: string, _args?: Record<string, unknown>) => undefined

export const convertFileSrc = (filePath: string) => filePath

class StorybookChannel {
  onmessage?: (message: unknown) => void
}

class StorybookResource {
  rid: number

  constructor(rid = 0) {
    this.rid = rid
  }

  async close() {
    return undefined
  }
}

export const Channel = StorybookChannel
export const Resource = StorybookResource

export default {
  invoke,
  convertFileSrc,
  Channel,
  Resource
}
