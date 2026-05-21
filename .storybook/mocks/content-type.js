const getContentType = (value) => {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'headers' in value) {
    const headers = value.headers
    if (headers && typeof headers === 'object' && 'content-type' in headers) {
      const contentType = headers['content-type']
      if (typeof contentType === 'string') {
        return contentType
      }
    }
  }

  throw new TypeError('argument string is required')
}

export const parse = (value) => {
  const header = getContentType(value)
  const [typePart, ...parameterParts] = header.split(';')
  const type = typePart.trim().toLowerCase()

  if (!type) {
    throw new TypeError('invalid media type')
  }

  const parameters = {}
  for (const parameter of parameterParts) {
    const [rawKey, ...rawValueParts] = parameter.split('=')
    const key = rawKey?.trim()
    if (!key) {
      continue
    }

    parameters[key.toLowerCase()] = rawValueParts.join('=').trim().replace(/^"(.*)"$/, '$1')
  }

  return { type, parameters }
}

export const format = ({ type, parameters = {} }) => {
  const serializedParameters = Object.entries(parameters)
    .map(([key, value]) => `; ${key}=${String(value)}`)
    .join('')

  return `${type}${serializedParameters}`
}

export default {
  parse,
  format
}
