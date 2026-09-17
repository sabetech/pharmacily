import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

export function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await resetPassword(email.trim())
      if (err) {
        setError('Something went wrong. Try again.')
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ground p-4">
      <Card className="w-full max-w-[400px]">
        <CardContent className="pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-people-bg text-people-ink">
            <i className="ph ph-lock-key text-[22px]" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Reset password</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            We send a reset link to the inbox if the account exists.
          </p>
          {sent ? (
            <div role="status" className="mt-4 flex items-start gap-2.5 rounded-field bg-sales-bg p-3 text-sm text-sales-ink">
              <i className="ph ph-check-circle mt-0.5 text-[18px]" aria-hidden="true" />
              <span>If that email exists, a reset link is on its way. Check inbox and spam.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-sm text-expiry-ink">
                  <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label htmlFor="reset-email" className="label-micro mb-1.5 block">Email</label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="pharmacy@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-12"
                />
              </div>
              <Button type="submit" size="lg" disabled={loading} className="h-12 w-full">
                {loading && <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />}
                {loading ? 'Sending link' : 'Send reset link'}
              </Button>
            </form>
          )}
          <div className="mt-3 text-center">
            <Link to="/pharmacy/login" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-live">
              <i className="ph ph-arrow-left" aria-hidden="true" /> Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
