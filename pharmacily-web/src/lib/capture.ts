export const CAPTURE_TTL_MS = 10 * 60 * 1000

export interface CapturedCoords {
  lat: number
  lng: number
  accuracy: number
  at: number
}

function key(token: string) {
  return `ph_capture_${token}`
}

function metaKey(token: string) {
  return `ph_capture_meta_${token}`
}

export function makeCaptureToken(): { token: string; expiresAt: number } {
  const token =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  const expiresAt = Date.now() + CAPTURE_TTL_MS
  try {
    localStorage.setItem(metaKey(token), JSON.stringify({ expiresAt, createdAt: Date.now() }))
  } catch {
    // storage unavailable, ignore
  }
  return { token, expiresAt }
}

export function captureLink(token: string): string {
  return `${window.location.origin}/capture/${token}`
}

export function qrImageUrl(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(link)}`
}

export function readCapture(token: string): CapturedCoords | null {
  try {
    const raw = localStorage.getItem(key(token))
    if (!raw) return null
    return JSON.parse(raw) as CapturedCoords
  } catch {
    return null
  }
}

export function writeCapture(token: string, coords: CapturedCoords) {
  try {
    localStorage.setItem(key(token), JSON.stringify(coords))
  } catch {
    // ignore
  }
}

export function readCaptureExpiry(token: string): number | null {
  try {
    const raw = localStorage.getItem(metaKey(token))
    if (!raw) return null
    return (JSON.parse(raw) as { expiresAt: number }).expiresAt
  } catch {
    return null
  }
}

export function isCaptureExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false
  return Date.now() > expiresAt
}
