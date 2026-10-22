import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { HandoffValues } from '@/lib/handoff'
import { cn } from '@/utils/helpers'

const GHANA_PHONE_RE = /^\+233\d{9}$/

const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
] as const

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+')) return `+${digits}`
  if (digits.startsWith('233')) return `+${digits}`
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`
  return `+233${digits}`
}

function accuracyPill(accuracy: number | null) {
  if (accuracy === null) return null
  if (accuracy <= 25) {
    return { text: `Accurate to ${Math.round(accuracy)} m`, cls: 'bg-stock-bg text-stock-ink' }
  }
  if (accuracy <= 50) {
    return { text: `Fair, ${Math.round(accuracy)} m`, cls: 'bg-sales-bg text-sales-ink' }
  }
  return { text: `Too vague, ${Math.round(accuracy)} m`, cls: 'bg-expiry-bg text-expiry-ink' }
}

interface OnboardingFormProps {
  onSubmit: (values: HandoffValues) => Promise<void>
  saving: boolean
  error?: string | null
  /** Shown above the GPS controls — for desktop fallback entry. */
  gpsNote?: string
}

export function OnboardingForm({ onSubmit, saving, error, gpsNote }: OnboardingFormProps) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [digitalAddress, setDigitalAddress] = useState('')
  const [licence, setLicence] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [geoError, setGeoError] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [manual, setManual] = useState(false)
  const [localError, setLocalError] = useState('')

  const pill = accuracyPill(accuracy)
  const hasCoords =
    lat.trim() !== '' && lng.trim() !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))
  const displayError = localError || error || ''

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('This device cannot share location. Enter coordinates by hand.')
      setManual(true)
      return
    }
    setGeoLoading(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false)
        setLat(String(pos.coords.latitude))
        setLng(String(pos.coords.longitude))
        setAccuracy(pos.coords.accuracy)
        setManual(false)
        if (pos.coords.accuracy > 50) {
          setGeoError('That fix is too vague for distance. Move outside or enter by hand.')
        }
      },
      (err) => {
        setGeoLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location is off. Turn it on in the browser bar, or enter coordinates by hand.')
          setManual(true)
        } else if (err.code === err.TIMEOUT) {
          setGeoError('Location timed out. Try again.')
        } else {
          setGeoError('Could not get location. Try again or enter by hand.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    const phone = toE164(contact)
    if (!name.trim()) {
      setLocalError('Enter the name of the pharmacy.')
      return
    }
    if (!GHANA_PHONE_RE.test(phone)) {
      setLocalError('Enter a valid Ghana number, for example 0244 118 902.')
      return
    }
    if (!address.trim()) {
      setLocalError('Enter the location address as customers see it on a receipt.')
      return
    }
    const latNum = Number(lat)
    const lngNum = Number(lng)
    if (!hasCoords || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setLocalError('Add GPS coordinates. Use your location or enter them by hand.')
      return
    }

    await onSubmit({
      name: name.trim(),
      phone,
      address: address.trim(),
      city: city.trim(),
      region,
      digitalAddress: digitalAddress.trim(),
      licence: licence.trim(),
      lat,
      lng,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
      {displayError && (
        <div role="alert" className="flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13.5px] text-expiry-ink">
          <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
          <span>{displayError}</span>
        </div>
      )}
      <div>
        <label htmlFor="ph-name" className="label-micro mb-1.5 block">Name of the pharmacy</label>
        <Input id="ph-name" placeholder="Bethel Pharmacy" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
      </div>
      <div>
        <label htmlFor="ph-contact" className="label-micro mb-1.5 block">Contact</label>
        <div className="flex gap-2">
          <span className="grid h-12 flex-none place-items-center rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3.5 text-sm font-semibold text-ink tnum">+233</span>
          <Input id="ph-contact" inputMode="tel" placeholder="244 118 902" value={contact} onChange={(e) => setContact(e.target.value)} className="h-12 tnum" />
        </div>
        <p className="mt-1.5 text-[12px] text-muted">WhatsApp receipts and stock alerts go to this number.</p>
      </div>
      <div>
        <label htmlFor="ph-address" className="label-micro mb-1.5 block">Location address</label>
        <Input id="ph-address" placeholder="Adenta Barrier, Accra" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="ph-city" className="label-micro mb-1.5 block">City</label>
          <Input id="ph-city" placeholder="Accra" value={city} onChange={(e) => setCity(e.target.value)} className="h-12" />
        </div>
        <div>
          <label htmlFor="ph-region" className="label-micro mb-1.5 block">Region</label>
          <select
            id="ph-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="flex h-12 w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3.5 py-2 text-[15px] text-ink focus:border-live focus:outline-none focus:ring-[3px] focus:ring-[rgba(29,122,95,0.12)]"
          >
            <option value="">Select region</option>
            {GHANA_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="ph-digital" className="label-micro mb-1.5 block">Digital address</label>
          <Input id="ph-digital" placeholder="GA-393-2210" value={digitalAddress} onChange={(e) => setDigitalAddress(e.target.value)} className="h-12 tnum" />
        </div>
        <div>
          <label htmlFor="ph-licence" className="label-micro mb-1.5 block">PCG licence (optional)</label>
          <Input id="ph-licence" placeholder="Licence number" value={licence} onChange={(e) => setLicence(e.target.value)} className="h-12 tnum" />
        </div>
      </div>

      <div>
        <label htmlFor="ph-gps" className="label-micro mb-1.5 block">GPS coordinates</label>
        <Input
          id="ph-gps"
          readOnly={!manual}
          placeholder="No location yet"
          value={hasCoords ? `${lat}, ${lng}` : ''}
          onChange={() => {}}
          className="h-12 tnum"
        />
        {gpsNote && <p className="mt-1.5 text-[12px] text-muted">{gpsNote}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={geoLoading} className="min-h-[44px]">
            {geoLoading
              ? <i className="ph ph-circle-notch animate-spin text-base" aria-hidden="true" />
              : <i className="ph ph-map-pin text-base" aria-hidden="true" />}
            {geoLoading ? 'Locating' : 'Use my location'}
          </Button>
          <button
            type="button"
            onClick={() => setManual((v) => !v)}
            className="inline-flex min-h-[44px] items-center px-3 text-sm font-medium text-live"
          >
            {manual ? 'Hide manual entry' : 'Enter by hand'}
          </button>
          {pill && (
            <span className={cn('rounded-full px-3 py-[5px] text-xs font-medium', pill.cls)}>{pill.text}</span>
          )}
        </div>

        {manual && (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="ph-lat" className="label-micro mb-1.5 block">Lat</label>
              <Input id="ph-lat" inputMode="decimal" placeholder="5.7021" value={lat} onChange={(e) => setLat(e.target.value)} className="h-12 tnum" />
            </div>
            <div>
              <label htmlFor="ph-lng" className="label-micro mb-1.5 block">Lng</label>
              <Input id="ph-lng" inputMode="decimal" placeholder="-0.1734" value={lng} onChange={(e) => setLng(e.target.value)} className="h-12 tnum" />
            </div>
          </div>
        )}

        {hasCoords && (
          <div className="mt-3 flex items-center gap-3 rounded-row bg-field p-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-field bg-stock-bg text-stock-ink">
              <i className="ph ph-map-pin text-[20px]" aria-hidden="true" />
            </span>
            <p className="text-xs text-muted">Location set · updated just now · <span className="tnum">{lat}, {lng}</span></p>
          </div>
        )}

        {geoError && (
          <div role="status" className="mt-3 flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13px] text-expiry-ink">
            <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
            <span>{geoError}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button type="submit" size="lg" disabled={saving} className="h-12 min-h-[44px] px-8">
          {saving && <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />}
          {saving ? 'Creating account' : 'Create pharmacy account'}
        </Button>
        <Link to="/pharmacy/login" className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-live">
          Back
        </Link>
      </div>
    </form>
  )
}
