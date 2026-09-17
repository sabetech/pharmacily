import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, onAuthStateChange } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string) => Promise<{ error: Error | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null; isNew: boolean }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  resendSignupEmail: (email: string) => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactElement | ReactElement[]
}

function toError(err: unknown): Error | null {
  if (!err) return null
  if (err instanceof Error) return err
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return new Error(String((err as { message: unknown }).message))
  }
  return new Error('Something went wrong. Try again.')
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /** Legacy magic-link sign in, kept for branch devices. Deprecated for Step 1 UI. */
  const signIn = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: toError(error) }
  }

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: toError(error) }
  }

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Client hint only: the handle_new_pharmacy_owner trigger reads this
        // to decide the default app_metadata. It never grants pharmacy_id.
        data: { signup_flow: 'pharmacy_owner' },
      },
    })
    // Supabase returns identities empty when the email already exists.
    // identities undefined (older responses) must NOT default to new.
    const isNew = !!data.user && Array.isArray(data.user.identities) && data.user.identities.length > 0
    try {
      if (!toError(error) && isNew && data.user) {
        localStorage.setItem('ph_pending_owner', data.user.id)
      } else {
        localStorage.removeItem('ph_pending_owner')
      }
    } catch {
      // storage unavailable, ignore
    }
    return { error: toError(error), isNew }
  }

  const signInWithGoogle = async () => {    try {
      // Entry-intent hint for AuthCallback (OAuth leaves the page, so no
      // pending marker can be set). Server claims decide; this only routes.
      sessionStorage.setItem('ph_auth_flow', 'pharmacy')
    } catch {
      // ignore
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: toError(error) }
  }

  const resendSignupEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error: toError(error) }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    return { error: toError(error) }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    resendSignupEmail,
    resetPassword,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
