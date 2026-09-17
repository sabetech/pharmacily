import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  captureLink,
  isCaptureExpired,
  makeCaptureToken,
  qrImageUrl,
  readCapture,
  readCaptureExpiry,
} from '@/lib/capture'
import { cn } from '@/utils/helpers'

const GHANA_PHONE_RE = /^\+233\d{9}$/
const QR_POLL_MS = 2000

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

export function PharmacyOnboarding() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

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
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [captureToken, setCaptureToken] = useState('')
  const [captureExpiry, setCaptureExpiry] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const { token, expiresAt } = makeCaptureToken()
    setCaptureToken(token)
    setCaptureExpiry(expiresAt)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Desktop polls for phone-submitted coordinates.
  useEffect(() => {
    if (!captureToken) return
    const poll = () => {
      const found = readCapture(captureToken)
      if (found) {
        setLat(String(found.lat))
        setLng(String(found.lng))
        setAccuracy(found.accuracy)
        setGeoError('')
        setManual(false)
      }
    }
    poll()
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes(captureToken)) poll()
    }
    window.addEventListener('storage', onStorage)
    const t = setInterval(poll, QR_POLL_MS)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(t)
    }
  }, [captureToken])

  const link = captureToken ? captureLink(captureToken) : ''
  const expiry = captureExpiry ?? readCaptureExpiry(captureToken)
  const expired = isCaptureExpired(expiry)
  const remaining = expiry ? Math.max(0, expiry - now) : 0
  const remainingLabel = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`

  const pill = accuracyPill(accuracy)
  const hasCoords = lat.trim() !== '' && lng.trim() !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))

  const regenerate = () => {
    const { token, expiresAt } = makeCaptureToken()
    setCaptureToken(token)
    setCaptureExpiry(expiresAt)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copied', description: 'Send it to the phone at the shop.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press the link to copy it.' })
    }
  }

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
    setFormError('')

    const e164 = toE164(contact)
    if (!name.trim()) {
      setFormError('Enter the name of the pharmacy.')
      return
    }
    if (!GHANA_PHONE_RE.test(e164)) {
      setFormError('Enter a valid Ghana number, for example 0244 118 902.')
      return
    }
    if (!address.trim()) {
      setFormError('Enter the location address as customers see it on a receipt.')
      return
    }
    const latNum = Number(lat)
    const lngNum = Number(lng)
    if (!hasCoords || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setFormError('Add GPS coordinates. Use your location, scan the QR code, or enter them by hand.')
      return
    }

    setSaving(true)
    try {
      const { data: inserted, error } = await supabase
        .from('pharmacies')
        .insert({
          owner_user_id: user?.id ?? null,
          name: name.trim(),
          address: address.trim(),
          city: city.trim() || null,
          state: region || null,
          zip_code: null,
          region: region || null,
          digital_address: digitalAddress.trim() || null,
          licence_no: licence.trim() || null,
          latitude: latNum,
          longitude: lngNum,
          phone: e164,
        })
        .select('id')
        .single()
      if (error || !inserted) {
        setFormError('Could not save your pharmacy. Check your connection and try again.')
        return
      }
      // Bind this device session to the new shop (last-bound-wins for
      // multi-shop owners). Never navigates on failure.
      const { error: bindError } = await supabase.rpc('bind_my_pharmacy', {
        p_pharmacy_id: (inserted as { id: string }).id,
      })
      if (bindError) {
        setFormError('Pharmacy saved, but this session could not link to it. Sign in again and try again.')
        return
      }
      // New claims only take effect on a fresh token (jwt_expiry 3600).
      await supabase.auth.refreshSession()
      try {
        if (user) localStorage.setItem(`ph_onboarded_${user.id}`, '1')
        localStorage.removeItem('ph_pending_owner')
      } catch {
        // ignore
      }
      toast({ title: 'Pharmacy added', description: `${name.trim()} is ready to sell from today.` })
      navigate('/pharmacy/dashboard')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-ground">
      <div className="relative hidden w-[46%] flex-none flex-col justify-between overflow-hidden bg-deep p-11 text-[#f4faf1] lg:flex">
        <div aria-hidden="true" className="absolute -right-52 -bottom-48 h-[520px] w-[520px] rounded-full bg-[#12503f]" />
        <div aria-hidden="true" className="absolute -top-28 -left-32 h-[300px] w-[300px] rounded-full bg-[#12503f]" />
        <div className="relative flex items-center gap-3">
          <svg width="42" height="42" viewBox="0 0 44 44" aria-hidden="true">
            <rect width="44" height="44" rx="14" fill="#d8ecb4" />
            <rect x="18.5" y="10" width="7" height="24" rx="3.5" fill="#0f4034" />
            <rect x="10" y="18.5" width="24" height="7" rx="3.5" fill="#0f4034" />
          </svg>
          <span className="font-display text-[23px] font-semibold tracking-tight text-[#f4faf1]">Pharmacily</span>
        </div>
        <div className="relative">
          <h1 className="font-display text-[44px] font-semibold leading-[1.06] tracking-tight">
            Add your pharmacy once, sell from today.
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15.5px] leading-[1.65] text-[rgba(233,244,228,0.8)]">
            Name, contact and location put you on the locator. GPS keeps distance and delivery time correct.
          </p>
        </div>
        <div className="relative flex gap-3">
          <span className="rounded-full bg-[#12503f] px-4 py-2 text-[12.5px] text-[#d8ecb4]">1,240 items tracked</span>
          <span className="rounded-full bg-[#12503f] px-4 py-2 text-[12.5px] text-[#a8dccf]">GA-393-2210 · Africa/Accra</span>
        </div>
      </div>

      <div className="grid flex-1 place-items-center px-4 py-8 lg:p-11">
        <div className="w-full max-w-[560px]">
          <div className="flex items-center gap-3">
            <p className="label-micro">Your pharmacy</p>
            <span className="rounded-full bg-stock-bg px-3 py-[5px] text-xs font-medium text-stock-ink">Step 2 of 2</span>
          </div>
          <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight text-ink">Add your pharmacy</h2>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-muted">
            This creates the owner record. Staff join it later.
          </p>

          <Card className="mt-6">
            <CardContent className="pt-6">
              {formError && (
                <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13.5px] text-expiry-ink">
                  <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
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
            </CardContent>
          </Card>

          {/* QR handoff, desktop only */}
          <Card className="mt-5 hidden lg:block">
            <CardContent className="pt-5">
              <p className="label-micro">Get coordinates via phone</p>
              <div className="mt-3 flex gap-5">
                <div className="grid w-[184px] flex-none place-items-center rounded-field bg-card p-2">
                  {expired ? (
                    <div className="grid h-[160px] w-[160px] place-items-center rounded-field bg-ground p-4 text-center text-[13px] text-expiry-ink">
                      This link expired. Make a new one.
                    </div>
                  ) : (
                    <img
                      src={link ? qrImageUrl(link) : ''}
                      alt={`QR code to open ${link} on the phone at the shop`}
                      width={160}
                      height={160}
                      className="h-[160px] w-[160px] rounded-field"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {hasCoords ? (
                    <p className="flex items-start gap-2 rounded-field bg-stock-bg p-3 text-[13px] text-stock-ink">
                      <i className="ph ph-check-circle mt-0.5 text-[18px]" aria-hidden="true" />
                      Location received. <span className="tnum">{lat}, {lng}</span>
                    </p>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-muted">
                      Scan with the phone that is at the shop. Link expires in{' '}
                      <span className="font-display font-semibold text-ink tnum">{remainingLabel}</span>.
                    </p>
                  )}
                  <p className="mt-2 break-all text-xs text-muted">{link}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={copyLink} className="min-h-[44px]">
                      <i className="ph ph-link text-base" aria-hidden="true" /> Copy link
                    </Button>
                    <button
                      type="button"
                      onClick={regenerate}
                      className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-live"
                    >
                      {expired ? 'Make a new link' : 'Refresh'}
                    </button>
                  </div>
                  <p className="mt-2 text-[12px] text-muted">Done. You can close the phone page after sending.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-[12px] leading-relaxed text-muted lg:hidden">
            On this phone, use the Use my location button above. On a computer, open this page on desktop to get a QR
            code for the shop phone.
          </p>
        </div>
      </div>
    </div>
  )
}
