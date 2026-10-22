import { useEffect, useState } from 'react'

export type DeviceType = 'phone' | 'tablet' | 'desktop'

/**
 * Classify the device the onboarding form is opening on.
 *
 * Desktop location is wifi/IP based (often hundreds of metres out), phones get
 * a real GNSS fix — so the form branches: phones get the GPS button, desktops
 * get the "finish on your phone" QR.
 *
 * `?device=phone|tablet|desktop` overrides detection for testing desktop
 * layout in a narrow window and vice versa.
 */
export function getDeviceType(): DeviceType {
  const override = new URLSearchParams(window.location.search).get('device')
  if (override === 'phone' || override === 'tablet' || override === 'desktop') return override

  const ua = navigator.userAgent

  // iPadOS 13+ masquerades as desktop Safari; touch-capable Mac giveaway.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'tablet'
  // Android tablets say "Android" but not "Mobile".
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'phone' : 'tablet'
  if (/\biPad\b/.test(ua)) return 'tablet'
  if (/\b(iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini|Mobi)\b/i.test(ua)) return 'phone'

  // Coarse pointer + narrow viewport = phone-sized browser with odd UA.
  if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024) return 'phone'

  return 'desktop'
}

/** Reactive version: follows orientation/resize across the Tailwind `lg` (1024px) split. */
export function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(() => getDeviceType())

  useEffect(() => {
    const update = () => setDevice(getDeviceType())
    const coarse = window.matchMedia('(pointer: coarse)')
    const compact = window.matchMedia('(max-width: 1023px)')
    coarse.addEventListener('change', update)
    compact.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      coarse.removeEventListener('change', update)
      compact.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return device
}
