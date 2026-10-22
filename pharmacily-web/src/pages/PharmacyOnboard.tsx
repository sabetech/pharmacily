import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { OnboardingForm } from '@/components/pharmacy/OnboardingForm'
import { isValidHandoffCode, submitHandoff, type HandoffValues } from '@/lib/handoff'

/**
 * `/pharmacy/onboard?c=<code>` — opened on the shop phone by scanning the QR
 * shown on the desktop. No session required: the one-time code authorises the
 * single submit, so the phone never signs in.
 */
export function PharmacyOnboard() {
  const [searchParams] = useSearchParams()
  const code = (searchParams.get('c') ?? '').trim().toLowerCase()
  const { session, loading } = useAuth()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const validCode = isValidHandoffCode(code)

  if (!validCode) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-ground">
          <span className="icon-circle h-12 w-12">
            <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
          </span>
        </div>
      )
    }
    // Signed in on this device already — straight to the normal form.
    if (session) return <Navigate to="/pharmacy/onboarding" replace />
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground p-4">
        <div className="w-full max-w-[420px] rounded-card bg-card p-6 text-center shadow-resting">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-expiry-bg text-expiry-ink">
            <i className="ph ph-warning-circle text-[22px]" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-[22px] font-semibold text-ink">Link not valid</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This phone link is missing or malformed. Back on the computer, press “Make a new link” and scan again.
          </p>
          <Link to="/" className="mt-4 inline-flex min-h-[44px] items-center px-3 font-semibold text-live">
            Go to Pharmacily
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (values: HandoffValues) => {
    setSaving(true)
    setError('')
    try {
      const result = await submitHandoff(code, values)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-ground px-4 py-7">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 44 44" aria-hidden="true">
            <rect width="44" height="44" rx="14" fill="#0f4034" />
            <rect x="18.5" y="10" width="7" height="24" rx="3.5" fill="#d8ecb4" />
            <rect x="10" y="18.5" width="24" height="7" rx="3.5" fill="#a8dccf" />
          </svg>
          <span className="font-display text-[19px] font-semibold tracking-tight text-ink">Pharmacily</span>
        </div>

        {done ? (
          <Card className="mt-7">
            <CardContent className="pt-7 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-stock-bg text-stock-ink">
                <i className="ph ph-check-circle text-[28px]" aria-hidden="true" />
              </span>
              <h1 className="mt-4 font-display text-[26px] font-semibold tracking-tight text-ink">Pharmacy saved</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                You can close this page. The computer it came from continues on its own.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-deep px-6 text-sm font-semibold text-[#f4faf1]"
              >
                Go to Pharmacily
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <p className="label-micro">Your pharmacy</p>
              <span className="rounded-full bg-stock-bg px-3 py-[5px] text-xs font-medium text-stock-ink">Step 2 of 2</span>
            </div>
            <h2 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-ink">Add your pharmacy</h2>
            <p className="mt-2 text-[14.5px] leading-[1.6] text-muted">
              Filling this in on the shop phone keeps GPS accurate to a few metres.
            </p>
            <Card className="mt-5">
              <CardContent className="pt-6">
                <OnboardingForm onSubmit={handleSubmit} saving={saving} error={error} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
