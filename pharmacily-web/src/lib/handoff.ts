import { supabase } from '@/lib/supabase'

export const HANDOFF_TTL_MS = 10 * 60 * 1000

export interface HandoffValues {
  name: string
  phone: string // E.164, normalised by the form
  address: string
  city: string
  region: string
  digitalAddress: string
  licence: string
  lat: string
  lng: string
}

export interface HandoffStatus {
  consumed: boolean
  pharmacyId: string | null
  expiresAt: string
}

/**
 * Origin the QR should point at. In local phone testing `location.origin` is
 * `localhost:3000` which the phone cannot reach — set `VITE_PUBLIC_ORIGIN` to
 * the LAN URL (e.g. http://192.168.1.235:3000) instead.
 */
export function publicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined
  return (configured || window.location.origin).replace(/\/$/, '')
}

export function handoffUrl(code: string): string {
  return `${publicOrigin()}/pharmacy/onboard?c=${code}`
}

export function isValidHandoffCode(code: string): boolean {
  return /^[0-9a-f]{16}$/.test(code)
}

export async function createHandoffCode(): Promise<{ code: string; error: string | null }> {
  const { data, error } = await supabase.rpc('create_onboard_handoff')
  if (error || typeof data !== 'string') {
    return { code: '', error: 'Could not create a phone link. Try again.' }
  }
  return { code: data, error: null }
}

export async function submitHandoff(
  code: string,
  values: HandoffValues
): Promise<{ pharmacyId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('submit_onboard_handoff', {
    p_code: code,
    p_name: values.name,
    p_phone: values.phone,
    p_address: values.address,
    p_city: values.city,
    p_region: values.region || null,
    p_digital_address: values.digitalAddress,
    p_licence_no: values.licence,
    p_lat: Number(values.lat),
    p_lng: Number(values.lng),
  })
  if (error) {
    const message = error.message || ''
    if (message.includes('handoff code')) {
      return { pharmacyId: null, error: 'This link is no longer valid. Back on the computer, make a new one.' }
    }
    if (message.includes('GPS coordinates')) {
      return { pharmacyId: null, error: 'Add GPS coordinates. Use your location or enter them by hand.' }
    }
    return { pharmacyId: null, error: message || 'Could not save your pharmacy. Check your connection and try again.' }
  }
  return { pharmacyId: (data as string) ?? null, error: null }
}

/** Desktop polls this with its own session (RLS: owner sees own rows only). */
export async function getHandoffStatus(code: string): Promise<HandoffStatus | null> {
  const { data, error } = await supabase
    .from('onboard_handoff')
    .select('consumed_at, pharmacy_id, expires_at')
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null
  return {
    consumed: Boolean(data.consumed_at),
    pharmacyId: (data.pharmacy_id as string | null) ?? null,
    expiresAt: data.expires_at as string,
  }
}
