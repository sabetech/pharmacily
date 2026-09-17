import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_S = 60

export function PharmacyVerify() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, resendSignupEmail } = useAuth()
  const { toast } = useToast()

  const stateEmail = (location.state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(stateEmail || searchParams.get('email') || '')
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')

  const expired = searchParams.get('error') === 'expired'

  // Prefer the signed-in address when the page is reached without one.
  useEffect(() => {
    if (!email && user?.email) setEmail(user.email)
  }, [email, user?.email])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter the email you used to create the account.')
      return
    }
    setSending(true)
    try {
      const { error } = await resendSignupEmail(trimmed)
      if (error) {
        const lower = error.message.toLowerCase()
        setError(
          lower.includes('too many') || lower.includes('rate limit')
            ? 'Too many tries. Wait 2 minutes and try again.'
            : 'Could not send the link. Check the address and try again.'
        )
        return
      }
      setCooldown(RESEND_COOLDOWN_S)
      toast({ title: 'Link sent', description: 'Check your inbox for the verification link.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-ground">
      <div className="grid flex-1 place-items-center px-4 py-8">
        <div className="w-full max-w-[408px]">
          <p className="label-micro">Verify email</p>
          <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight text-ink">
            Check your inbox
          </h2>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-muted">
            {email ? (
              <>We sent a verification link to <span className="font-semibold text-ink">{email}</span>. Open it, then continue to add your pharmacy.</>
            ) : (
              <>Enter the email you used to create the account. We will send a verification link.</>
            )}
          </p>

          <Card className="mt-6">
            <CardContent className="pt-6">
              {expired && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13.5px] leading-snug text-expiry-ink"
                >
                  <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                  <span>That link expired. Request a new one below.</span>
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13.5px] leading-snug text-expiry-ink"
                >
                  <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleResend} className="flex flex-col gap-3.5" noValidate>
                <div>
                  <label htmlFor="verify-email" className="label-micro mb-1.5 block">
                    Email
                  </label>
                  <div className="relative">
                    <i
                      className="ph ph-envelope-simple pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-muted"
                      aria-hidden="true"
                    />
                    <Input
                      id="verify-email"
                      type="email"
                      autoComplete="email"
                      placeholder="pharmacy@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={sending}
                      className="h-12 pl-11"
                    />
                  </div>
                </div>

                <Button type="submit" size="lg" disabled={sending || cooldown > 0} className="mt-1 h-12 w-full text-[15px]">
                  {sending && <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />}
                  {sending ? 'Sending link' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
                </Button>
              </form>

              {import.meta.env.DEV && (
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                  Local test inbox:{' '}
                  <a
                    href="http://localhost:54324"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-live"
                  >
                    Mailpit on :54324
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 text-center">
            <button
              onClick={() => navigate('/pharmacy/login')}
              className="inline-flex min-h-[44px] items-center px-3 text-sm font-semibold text-live"
            >
              Back to sign in
            </button>
          </div>
          <div className="text-center">
            <Link to="/" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-live">
              <i className="ph ph-arrow-left" aria-hidden="true" /> Back to search
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
