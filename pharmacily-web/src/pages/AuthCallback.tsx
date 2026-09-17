import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Exchange OAuth / OTP / recovery codes when present.
        const url = new URL(window.location.href)
        if (url.searchParams.get('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (error) throw error
        } else {
          const { error } = await supabase.auth.getSession()
          if (error) throw error
        }

        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) {
          navigate('/pharmacy/login')
          return
        }

        const role = session?.user?.app_metadata?.role
        const pharmacyId = session?.user?.app_metadata?.pharmacy_id as string | undefined
        if (role === 'pharmacy_staff' && pharmacyId) {
          navigate('/pharmacy/dashboard')
          return
        }

        // New owner: pharmacist default with no shop bound yet. Server claims
        // are the source of truth; localStorage is only an entry-intent hint
        // (Google OAuth sets no pending marker before leaving the page).
        if (role === 'pharmacy_staff' && !pharmacyId) {
          navigate('/pharmacy/onboarding')
          return
        }

        let intended: string | null = null
        let pending: string | null = null
        let onboarded: string | null = null
        try {
          intended = sessionStorage.getItem('ph_auth_flow')
          pending = localStorage.getItem('ph_pending_owner')
          onboarded = localStorage.getItem(`ph_onboarded_${user.id}`)
        } catch {
          // storage unavailable, fall through to locator home
        }
        // user_metadata hint survives cross-device link opens, where neither
        // localStorage marker nor sessionStorage intent is present.
        const signupFlow = (user.user_metadata as { signup_flow?: string } | null)?.signup_flow
        if (!onboarded && (pending === user.id || intended === 'pharmacy' || signupFlow === 'pharmacy_owner')) {
          try {
            sessionStorage.removeItem('ph_auth_flow')
          } catch {
            // ignore
          }
          navigate('/pharmacy/onboarding')
          return
        }
        navigate('/')
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Auth callback error:', err)
        }
        // Expired signup links go back to the verify page with a resend
        // path; everything else keeps the existing login error surface.
        const type = new URL(window.location.href).searchParams.get('type')
        if (type === 'signup') {
          navigate('/pharmacy/verify?error=expired')
          return
        }
        navigate('/auth/login?error=callback_failed')
      }
    }

    handleAuthCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground">
      <div className="text-center">
        <span className="icon-circle mx-auto mb-4 h-12 w-12">
          <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted">Completing sign in...</p>
      </div>
    </div>
  )
}
