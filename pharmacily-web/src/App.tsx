import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from '@/components/ui/toaster'
import { Landing } from '@/pages/Landing'
import { SearchResults } from '@/pages/SearchResults'
import { Favorites } from '@/pages/Favorites'
import { PharmacyLogin } from '@/pages/PharmacyLogin'
import { PharmacyDashboard } from '@/pages/PharmacyDashboard'
import { AuthCallback } from '@/pages/AuthCallback'
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Please log in to access this page</div>
  }

  return <>{children}</>
}

function PharmacyProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Check for pharmacy_staff role in JWT
  const isPharmacyStaff = session?.user?.app_metadata?.role === 'pharmacy_staff'

  if (!user || !isPharmacyStaff) {
    return <div className="min-h-screen flex items-center justify-center">Pharmacy staff access required</div>
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
            <Route path="/auth/login" element={<PharmacyLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/pharmacy/login" element={<PharmacyLogin />} />
            <Route
              path="/pharmacy/dashboard"
              element={
                <PharmacyProtectedRoute>
                  <PharmacyDashboard />
                </PharmacyProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}