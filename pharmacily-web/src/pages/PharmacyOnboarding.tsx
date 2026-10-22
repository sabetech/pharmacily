import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useDeviceType } from '@/lib/device'
import { OnboardingForm } from '@/components/pharmacy/OnboardingForm'
import {
  HANDOFF_TTL_MS,
  createHandoffCode,
  getHandoffStatus,
  handoffUrl,
  type HandoffValues,
} from '@/lib/handoff'

const HANDOFF_POLL_MS = 2500

export function PharmacyOnboarding() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const device = useDeviceType()

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Desktop → phone handoff (one-time code behind the QR).
  const [handoffCode, setHandoffCode] = useState('')
  const [handoffError, setHandoffError] = useState('')
  const [creatingCode, setCreatingCode] = useState(false)
  const [expiresAt, setExpiresAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [showDesktopForm, setShowDesktopForm] = useState(false)

  const isPhone = device === 'phone' || device === 'tablet'

  const newHandoffCode = async () => {
    setCreatingCode(true)
    setHandoffError('')
    try {
      const { code, error } = await createHandoffCode()
      if (error) {
        setHandoffError(error)
        return
      }
      setHandoffCode(code)
      setExpiresAt(Date.now() + HANDOFF_TTL_MS)
    } finally {
      setCreatingCode(false)
    }
  }

  useEffect(() => {
    if (isPhone) return
    if (!handoffCode && !creatingCode && !handoffError) void newHandoffCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, handoffCode, creatingCode, handoffError])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Desktop waits for the phone to finish, then picks up the fresh claims.
  useEffect(() => {
    if (!handoffCode || isPhone) return
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getHandoffStatus(handoffCode)
        if (cancelled || !status?.consumed) return
        try {
          if (user) localStorage.setItem(`ph_onboarded_${user.id}`, '1')
          localStorage.removeItem('ph_pending_owner')
        } catch {
          // storage unavailable, ignore
        }
        await supabase.auth.refreshSession()
        toast({ title: 'Pharmacy added', description: 'Finished on your phone. Opening your dashboard.' })
        navigate('/pharmacy/dashboard')
      } catch {
        // transient fetch/session failure — next tick retries
      }
    }
    void poll()
    const t = setInterval(poll, HANDOFF_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffCode, isPhone, user?.id])

  const link = handoffCode ? handoffUrl(handoffCode) : ''
  const expired = expiresAt > 0 && now > expiresAt
  const remaining = Math.max(0, expiresAt - now)
  const remainingLabel = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copied', description: 'Open it on the shop phone.' })
    } catch {
      toast({ title: 'Copy failed', description: 'Long-press the link to copy it.' })
    }
  }

  const handleSessionSubmit = async (values: HandoffValues) => {
    setSaving(true)
    setFormError('')
    try {
      const { data: inserted, error } = await supabase
        .from('pharmacies')
        .insert({
          owner_user_id: user?.id ?? null,
          name: values.name,
          address: values.address,
          city: values.city || null,
          state: values.region || null,
          zip_code: null,
          region: values.region || null,
          digital_address: values.digitalAddress || null,
          licence_no: values.licence || null,
          latitude: Number(values.lat),
          longitude: Number(values.lng),
          phone: values.phone,
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
      toast({ title: 'Pharmacy added', description: `${values.name} is ready to sell from today.` })
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
            {isPhone
              ? 'This creates the owner record. Staff join it later.'
              : 'Finish on the shop phone — its GPS is accurate to a few metres, a computer’s is not.'}
          </p>

          {isPhone ? (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <OnboardingForm onSubmit={handleSessionSubmit} saving={saving} error={formError} />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="mt-6">
                <CardContent className="pt-5">
                  <p className="label-micro">Finish on your phone</p>
                  <div className="mt-3 flex flex-col gap-5 sm:flex-row">
                    <div className="grid w-full flex-none place-items-center rounded-field bg-card p-2 sm:w-[184px]">
                      {!handoffCode || expired ? (
                        <div className="grid h-[160px] w-[160px] place-items-center rounded-field bg-ground p-4 text-center text-[13px] text-expiry-ink">
                          {handoffError || 'This link expired. Make a new one.'}
                        </div>
                      ) : (
                        <QRCodeSVG
                          value={link}
                          size={160}
                          marginSize={2}
                          bgColor="#FFFFFF"
                          fgColor="#16241D"
                          level="M"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-relaxed text-muted">
                        Scan with the phone at the shop. The form opens there and gets a real GPS fix — this
                        computer cannot. Link expires in{' '}
                        <span className="font-display font-semibold text-ink tnum">{remainingLabel}</span>.
                      </p>
                      {link && !expired && <p className="mt-2 break-all text-xs text-muted">{link}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!link || expired} className="min-h-[44px]">
                          <i className="ph ph-link text-base" aria-hidden="true" /> Copy link
                        </Button>
                        <button
                          type="button"
                          onClick={() => void newHandoffCode()}
                          disabled={creatingCode}
                          className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-live disabled:opacity-60"
                        >
                          <i className="ph ph-arrows-clockwise mr-1.5 text-base" aria-hidden="true" />
                          {expired || handoffError ? 'Make a new link' : 'Refresh'}
                        </button>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted" role="status">
                        <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" />
                        Waiting for the phone. This page continues by itself when it is done.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDesktopForm((v) => !v)}
                    className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-live"
                  >
                    {showDesktopForm ? 'Hide' : 'Fill in on this device instead'}
                    <i className={showDesktopForm ? 'ph ph-caret-up' : 'ph ph-caret-down'} aria-hidden="true" />
                  </button>
                </CardContent>
              </Card>

              {showDesktopForm && (
                <Card className="mt-5">
                  <CardContent className="pt-6">
                    <OnboardingForm
                      onSubmit={handleSessionSubmit}
                      saving={saving}
                      error={formError}
                      gpsNote="Desktop location is usually off by hundreds of metres. The phone QR gives a fix accurate to a few metres."
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            Already added it?{' '}
            <Link to="/pharmacy/login" className="font-semibold text-live">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
