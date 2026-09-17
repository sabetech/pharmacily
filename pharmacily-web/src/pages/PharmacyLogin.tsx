import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/utils/helpers'

type Mode = 'signin' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function mapAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid credentials') || lower.includes('email or password')) {
    return 'That email or password did not match. Try again or reset it.'
  }
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('already in use')) {
    return 'This account already exists. Sign in instead.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirm your email first, then sign in.'
  }
  if (lower.includes('too many') || lower.includes('rate limit')) {
    return 'Too many tries. Wait 2 minutes and try again.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'No connection. Check data and try again.'
  }
  return 'Something went wrong. Try again.'
}

export function PharmacyLogin({ mode = 'signin' }: { mode?: Mode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth()
  const { toast } = useToast()

  const [tab, setTab] = useState<Mode>(mode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirm?: string }>({})
  const [formError, setFormError] = useState('')
  const [verifyEmail, setVerifyEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const isSignup = tab === 'signup'

  // Surface AuthCallback failures (?error=callback_failed) instead of
  // swallowing them.
  useEffect(() => {
    if (searchParams.get('error') === 'callback_failed') {
      setFormError('Sign in did not complete. Try again.')
    }
  }, [searchParams])

  const switchTab = (next: Mode) => {
    setTab(next)
    setPassword('')
    setConfirm('')
    setFieldErrors({})
    setFormError('')
    setVerifyEmail('')
  }

  const handleCaps = (e: React.KeyboardEvent) => {
    try {
      const on = e.getModifierState?.('CapsLock')
      if (typeof on === 'boolean') setCapsOn(on)
    } catch {
      // unsupported browser, ignore
    }
  }

  const validate = () => {
    const next: typeof fieldErrors = {}
    if (!EMAIL_RE.test(email.trim())) {
      next.email = email.trim() ? 'That email looks incomplete. Check spelling and try again.' : 'Enter your work email.'
    }
    if (!password) {
      next.password = 'Enter your password.'
    } else if (isSignup && password.length < 8) {
      next.password = 'Use 8 or more characters.'
    }
    if (isSignup && confirm !== password) {
      next.confirm = 'Passwords do not match.'
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleGoogle = async () => {
    setFormError('')
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) {
      if (error.message.toLowerCase().includes('closed') || error.message.toLowerCase().includes('cancel')) {
        setFormError('Google sign in was closed. Try again or use email.')
      } else {
        setFormError(mapAuthError(error.message))
      }
      return
    }
    // OAuth redirects to /auth/callback, which routes new owners to onboarding.
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setVerifyEmail('')
    if (!validate()) return

    setLoading(true)
    try {
      if (isSignup) {
        const { error, isNew } = await signUpWithPassword(email.trim(), password)
        if (error) {
          setFormError(mapAuthError(error.message))
          return
        }
        if (!isNew) {
          setFormError('This account already exists. Sign in instead.')
          return
        }
        toast({
          title: 'Account created',
          description: 'Check your inbox to verify your email.',
        })
        navigate('/pharmacy/verify', { state: { email: email.trim() } })
      } else {
        const { error } = await signInWithPassword(email.trim(), password)
        if (error) {
          const mapped = mapAuthError(error.message)
          setFormError(mapped)
          if (mapped.startsWith('Confirm your email first')) {
            setVerifyEmail(email.trim())
          }
          return
        }
        navigate('/pharmacy/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  const busy = loading || googleLoading
  const passwordStrength = password.length === 0
    ? 'Use 8 or more characters.'
    : password.length >= 8
      ? `Good, ${password.length} characters.`
      : 'Use 8 or more characters.'

  return (
    <div className="flex min-h-screen bg-ground">
      {/* Left storytelling panel, desktop */}
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
            Stock, sales and expiry in one place.
          </h1>
          <p className="mt-5 max-w-[38ch] text-[15.5px] leading-[1.65] text-[rgba(233,244,228,0.8)]">
            Dispense at the counter, log every sale, and see what expires before it costs you money.
          </p>
        </div>
        <div className="relative flex gap-3">
          <span className="rounded-full bg-[#12503f] px-4 py-2 text-[12.5px] text-[#d8ecb4]">1,240 items tracked</span>
          <span className="rounded-full bg-[#12503f] px-4 py-2 text-[12.5px] text-[#a8dccf]">Adenta · Accra</span>
        </div>
      </div>

      {/* Mobile top band */}
      <div className="lg:hidden">
      </div>

      <div className="flex flex-1 flex-col">
        <div className="bg-deep px-4 pb-10 pt-6 lg:hidden">
          <Link to="/" aria-label="Pharmacily home" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 44 44" aria-hidden="true">
              <rect width="44" height="44" rx="14" fill="#d8ecb4" />
              <rect x="18.5" y="10" width="7" height="24" rx="3.5" fill="#0f4034" />
              <rect x="10" y="18.5" width="24" height="7" rx="3.5" fill="#0f4034" />
            </svg>
            <span className="font-display text-xl font-semibold text-[#f4faf1]">Pharmacily</span>
          </Link>
          <p className="mt-4 font-display text-[28px] font-semibold leading-[1.1] text-[#f4faf1]">
            Stock, sales and expiry in one place.
          </p>
          <span className="mt-3 inline-block rounded-full bg-[#12503f] px-4 py-2 text-[12.5px] text-[#a8dccf]">
            Adenta · Accra
          </span>
        </div>

        <div className="grid flex-1 place-items-center px-4 py-8 lg:p-11">
          <div className="-mt-8 w-full max-w-[408px] lg:mt-0">
            <p className="label-micro">Access</p>
            <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight text-ink">
              {isSignup ? 'Create account' : 'Sign in'}
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-[1.6] text-muted">
              {isSignup
                ? 'Create the owner account for a new pharmacy.'
                : 'Use the account your pharmacist added, or sign in as the owner.'}
            </p>

            {/* Segmented Sign in / Create account */}
            <div
              role="tablist"
              aria-label="Choose sign in or create account"
              className="mt-6 grid h-12 grid-cols-2 rounded-full bg-ground p-[3px]"
            >
              {(['signin', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={tab === m}
                  onClick={() => switchTab(m)}
                  disabled={busy}
                  className={cn(
                    'h-full rounded-full text-[12.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live',
                    tab === m ? 'bg-deep text-[#f4faf1]' : 'text-muted hover:text-ink'
                  )}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            {/* Method B: Google (secondary, positional first) */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleGoogle}
              disabled={busy}
              aria-label="Continue with Google for pharmacy access"
              className="mt-5 h-12 w-full gap-2.5 text-[15px]"
            >
              {googleLoading ? (
                <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />
              ) : (
                <i className="ph ph-google-logo text-[20px]" aria-hidden="true" />
              )}
              {googleLoading ? 'Waiting for Google' : 'Continue with Google'}
            </Button>

            <div className="my-5 flex items-center gap-3.5" aria-hidden="true">
              <span className="h-px flex-1 bg-[rgba(16,50,40,0.12)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">or use email</span>
              <span className="h-px flex-1 bg-[rgba(16,50,40,0.12)]" />
            </div>

            <Card>
              <CardContent className="pt-6">
                {formError && (
                  <div
                    role="alert"
                    tabIndex={-1}
                    className="mb-4 flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-[13.5px] leading-snug text-expiry-ink"
                  >
                    <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}
                {verifyEmail && (
                  <button
                    type="button"
                    onClick={() => navigate('/pharmacy/verify', { state: { email: verifyEmail } })}
                    className="mb-4 inline-flex min-h-[44px] items-center gap-1.5 px-1 text-sm font-semibold text-live"
                  >
                    <i className="ph ph-envelope-simple text-base" aria-hidden="true" />
                    Resend verification link
                  </button>
                )}

                <form onSubmit={handleSubmit} aria-busy={busy} className="flex flex-col gap-3.5" noValidate>
                  <div>
                    <label htmlFor="email" className="label-micro mb-1.5 block">
                      Email
                    </label>
                    <div className="relative">
                      <i
                        className="ph ph-envelope-simple pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-muted"
                        aria-hidden="true"
                      />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="pharmacy@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={busy}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                        className="h-12 pl-11"
                      />
                    </div>
                    {fieldErrors.email && (
                      <p id="email-error" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-expiry-label">
                        <i className="ph ph-warning-circle text-base" aria-hidden="true" />
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="label-micro mb-1.5 block">
                      Password
                    </label>
                    <div className="relative">
                      <i
                        className="ph ph-lock-key pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-muted"
                        aria-hidden="true"
                      />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={handleCaps}
                        disabled={busy}
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={fieldErrors.password ? 'password-error' : 'password-hint'}
                        className="h-12 pl-11 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        disabled={busy}
                        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live"
                      >
                        <i className={cn('text-[20px]', showPassword ? 'ph ph-eye-slash' : 'ph ph-eye')} aria-hidden="true" />
                      </button>
                    </div>
                    {fieldErrors.password ? (
                      <p id="password-error" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-expiry-label">
                        <i className="ph ph-warning-circle text-base" aria-hidden="true" />
                        {fieldErrors.password}
                      </p>
                    ) : (
                      <p id="password-hint" className="mt-1.5 text-[12.5px] text-muted">
                        {isSignup ? passwordStrength : 'Use the password set for this account.'}
                      </p>
                    )}
                    {capsOn && password.length > 0 && (
                      <p aria-live="polite" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
                        <i className="ph ph-warning text-base" aria-hidden="true" />
                        Caps lock is on.
                      </p>
                    )}
                  </div>

                  {isSignup && (
                    <div className={cn(fieldErrors.confirm && 'rounded-field bg-expiry-tint p-3')}>
                      <label htmlFor="confirm" className="label-micro mb-1.5 block">
                        Confirm password
                      </label>
                      <div className="relative">
                        <i
                          className="ph ph-lock-key pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-muted"
                          aria-hidden="true"
                        />
                        <Input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Repeat your password"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                          disabled={busy}
                          aria-invalid={Boolean(fieldErrors.confirm)}
                          aria-describedby={fieldErrors.confirm ? 'confirm-error' : undefined}
                          className={cn('h-12 pl-11 pr-12', fieldErrors.confirm && 'bg-expiry-tint')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((v) => !v)}
                          aria-pressed={showConfirm}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          disabled={busy}
                          className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live"
                        >
                          <i className={cn('text-[20px]', showConfirm ? 'ph ph-eye-slash' : 'ph ph-eye')} aria-hidden="true" />
                        </button>
                      </div>
                      {fieldErrors.confirm && (
                        <p id="confirm-error" className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-expiry-ink">
                          <i className="ph ph-warning-circle text-base text-expiry-label" aria-hidden="true" />
                          {fieldErrors.confirm}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Method A: Email + password (single deep primary) */}
                  <Button type="submit" size="lg" disabled={busy} className="mt-1 h-12 w-full text-[15px]">
                    {loading && <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />}
                    {loading ? 'Checking account' : isSignup ? 'Create account' : 'Sign in'}
                  </Button>
                </form>

                {!isSignup && (
                  <div className="mt-3 text-center">
                    <Link
                      to="/pharmacy/forgot-password"
                      className="inline-flex min-h-[44px] items-center px-3 text-sm font-medium text-live"
                    >
                      Forgot password
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-5">
              <CardContent className="flex flex-col gap-4 pt-5">
                <div className="flex gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-stock-bg text-stock-ink">
                    <i className="ph ph-shield-check text-[18px]" aria-hidden="true" />
                  </span>
                  <p className="text-[13.5px] leading-[1.55] text-muted">
                    Only accounts linked to your pharmacy can sign in. Your role, pharmacist or counter staff, comes
                    with the account.
                  </p>
                </div>
                <div className="flex gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sales-bg text-sales-ink">
                    <i className="ph ph-clock-counter-clockwise text-[18px]" aria-hidden="true" />
                  </span>
                  <p className="text-[13.5px] leading-[1.55] text-muted">
                    Every sale is stamped with the account that made it.
                  </p>
                </div>
              </CardContent>
            </Card>

            <p className="mt-5 text-center text-[12.5px] leading-relaxed text-muted">
              {isSignup ? (
                <>Already set up. <button onClick={() => switchTab('signin')} className="font-semibold text-live">Sign in instead.</button></>
              ) : (
                <>New pharmacy owner. <button onClick={() => switchTab('signup')} className="font-semibold text-live">Create owner account.</button></>
              )}
              <br />
              Branch staff without a login. Ask the pharmacist on duty to add you from Settings → Staff.
            </p>
            <div className="mt-2 text-center">
              <Link to="/" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-live">
                <i className="ph ph-arrow-left" aria-hidden="true" /> Back to search
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
