const _Channel = class {
  onmessage = undefined
}
const _Resource = class {
  rid = 0
  async close() {}
}
const _PluginListener = class {
  async unlisten() {}
}

export const Channel = _Channel
export const Resource = _Resource
export const PluginListener = _PluginListener
export const invoke = async (_cmd, _args) => undefined
export const convertFileSrc = (f) => f
export const isTauri = () => false
export const checkPermissions = async () => ({})
export const requestPermissions = async () => ({})
export const addPluginListener = async (_p, _e, _cb) => ({ unlisten: async () => {} })
export const transformCallback = (cb, _once) => cb
export const SERIALIZE_TO_IPC_FN = 'toJSON'
