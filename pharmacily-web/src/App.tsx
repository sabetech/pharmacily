import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/toaster'
import { Landing } from '@/pages/Landing'
import { SearchResults } from '@/pages/SearchResults'
import { Favorites } from '@/pages/Favorites'
import { PharmacyLogin } from '@/pages/PharmacyLogin'
import { PharmacyOnboarding } from '@/pages/PharmacyOnboarding'
import { CaptureCoordinates } from '@/pages/CaptureCoordinates'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { PharmacyDashboard } from '@/pages/PharmacyDashboard'
import { Sell } from '@/pages/Sell'
import { ManageDrugs } from '@/pages/ManageDrugs'
import { StockTakeList } from '@/pages/StockTakeList'
import { StockTakeSheet } from '@/pages/StockTakeSheet'
import { StockTakeReview } from '@/pages/StockTakeReview'
import { Alerts } from '@/pages/Alerts'
import { Suppliers } from '@/pages/Suppliers'
import { Reports } from '@/pages/Reports'
import { AuthCallback } from '@/pages/AuthCallback'
import { PharmacyVerify } from '@/pages/PharmacyVerify'
import { PharmacyLayout } from '@/components/pharmacy/PharmacyLayout'
import { useAuth } from '@/hooks/useAuth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <span className="icon-circle h-12 w-12">
          <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
        </span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground p-4">
        <div className="rounded-card bg-card p-6 text-center text-sm text-muted shadow-resting">
          Log in to access this page.
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link to="/pharmacy/login" className="font-semibold text-live">
              Sign in
            </Link>
            <Link to="/" className="font-semibold text-live">
              Back to search
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function PharmacyProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <span className="icon-circle h-12 w-12">
          <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
        </span>
      </div>
    )
  }

  // Check for pharmacy_staff role in JWT
  const isPharmacyStaff = session?.user?.app_metadata?.role === 'pharmacy_staff'

  if (!user || !isPharmacyStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground p-4">
        <div className="rounded-card bg-card p-6 text-center text-sm text-muted shadow-resting">
          Pharmacy staff access required.
          <div className="mt-3 flex items-center justify-center gap-4">
            <Link to="/pharmacy/login" className="font-semibold text-live">
              Sign in
            </Link>
            <Link to="/" className="font-semibold text-live">
              Back to search
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function EmailConfirmedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground">
        <span className="icon-circle h-12 w-12">
          <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
        </span>
      </div>
    )
  }

  // Unconfirmed sessions cannot reach Add your pharmacy. Google-OAuth users
  // arrive pre-confirmed and pass through untouched.
  if (user && !user.email_confirmed_at) {
    return <Navigate to="/pharmacy/verify" replace />
  }

  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/auth/login" element={<PharmacyLogin mode="signin" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/capture/:token" element={<CaptureCoordinates />} />
            <Route path="/pharmacy/login" element={<PharmacyLogin mode="signin" />} />
            <Route path="/pharmacy/signup" element={<PharmacyLogin mode="signup" />} />
            <Route path="/pharmacy/verify" element={<PharmacyVerify />} />
            <Route path="/pharmacy/forgot-password" element={<ForgotPassword />} />
            <Route path="/pharmacy/onboarding" element={<ProtectedRoute><EmailConfirmedRoute><PharmacyOnboarding /></EmailConfirmedRoute></ProtectedRoute>} />
            <Route
              path="/pharmacy"
              element={
                <PharmacyProtectedRoute>
                  <PharmacyLayout />
                </PharmacyProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/pharmacy/dashboard" replace />} />
              <Route path="dashboard" element={<PharmacyDashboard />} />
              <Route path="sell" element={<Sell />} />
              <Route path="drugs" element={<ManageDrugs />} />
              <Route path="stock-take" element={<StockTakeList />} />
              <Route path="stock-take/:sessionId" element={<StockTakeSheet />} />
              <Route path="stock-take/:sessionId/review" element={<StockTakeReview />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="reports" element={<Reports />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
