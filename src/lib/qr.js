import QRCode from 'qrcode'

export async function qrDataUrl(text, size = 240) {
  if (!text) return ''
  return QRCode.toDataURL(String(text), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#050607', light: '#ffffff' },
  })
}
