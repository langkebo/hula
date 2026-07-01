export const parse = (sdp) => {
  const media = []
  let session = {}

  for (const line of sdp.split('\r\n')) {
    if (line.startsWith('m=')) {
      media.push({ rtp: [], fmtp: [] })
    }
  }

  return { media, ...session }
}

export const write = (session) => {
  return ''
}

export const parseParams = (str) => ({})
export const parseFmtpConfig = (str) => ({})
export const parsePayloads = (str) => []
export const parseRemoteCandidates = (str) => []
export const parseImageAttributes = (str) => []
export const parseSimulcastStreamList = (str) => []
export const parseRtpMap = (str) => ({})

export default { parse, write, parseParams, parseFmtpConfig, parsePayloads, parseRemoteCandidates, parseImageAttributes, parseSimulcastStreamList, parseRtpMap }
