import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
}

export async function generateQRCode(text: string, options?: QRCodeOptions): Promise<string> {
  const dataUrl = await QRCode.toDataURL(text, {
    width: options?.width || 256,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#ffffff'
    }
  })
  return dataUrl
}

export async function generateQRCodeBuffer(text: string, options?: QRCodeOptions): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(text, {
    width: options?.width || 256,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#ffffff'
    }
  })
  return buffer
}

export function parseQRCodeData(data: string): { type: string; content: string } | null {
  try {
    if (data.startsWith('matrix:')) {
      return { type: 'matrix', content: data.slice(7) }
    }
    if (data.startsWith('https://') || data.startsWith('http://')) {
      return { type: 'url', content: data }
    }
    return { type: 'text', content: data }
  } catch {
    return null
  }
}
