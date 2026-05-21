export const invoke = async () => undefined

export const convertFileSrc = (filePath) => filePath

export function Channel() {
  this.onmessage = undefined
}

export class Resource {
  constructor(rid = 0) {
    this.rid = rid
  }

  async close() {
    return undefined
  }
}

export default {
  invoke,
  convertFileSrc,
  Channel,
  Resource
}
