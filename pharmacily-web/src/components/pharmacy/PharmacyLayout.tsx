import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar, type SidebarKey } from '@/components/pharmacy/Sidebar'
import { PharmacyTopBar } from '@/components/pharmacy/PharmacyTopBar'
import { useAuth } from '@/hooks/useAuth'
import { usePharmacyRole, usePharmacyId } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory, usePharmacy } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'

export const LOW_STOCK_AT = 20

interface RouteMeta {
  key: SidebarKey
  title: string
  kicker: () => string
  staffVisible: boolean
}

const todayKicker = () =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

const ROUTES: Record<string, RouteMeta> = {
  '/pharmacy/dashboard': {
    key: 'dashboard',
    title: 'Dashboard',
    kicker: todayKicker,
    staffVisible: true,
  },
  '/pharmacy/sell': { key: 'sell', title: 'Sell', kicker: () => 'Counter · new sale', staffVisible: true },
  '/pharmacy/drugs': { key: 'drugs', title: 'Manage drugs', kicker: () => 'Stock records', staffVisible: true },
  '/pharmacy/stock-take': {
    key: 'stock-take',
    title: 'Take stock',
    kicker: () => 'Count sessions',
    staffVisible: true,
  },
  '/pharmacy/alerts': { key: 'alerts', title: 'Alerts', kicker: () => 'Expiry and low stock', staffVisible: true },
  '/pharmacy/suppliers': {
    key: 'suppliers',
    title: 'Suppliers',
    kicker: () => 'Purchasing',
    staffVisible: false,
  },
  '/pharmacy/reports': {
    key: 'reports',
    title: 'Reports',
    kicker: () => 'Sales and stock',
    staffVisible: false,
  },
}

function matchRoute(pathname: string): { base: string; meta: RouteMeta } {
  const bases = Object.keys(ROUTES).sort((a, b) => b.length - a.length)
  for (const base of bases) {
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      return { base, meta: ROUTES[base] }
    }
  }
  return { base: '/pharmacy/dashboard', meta: ROUTES['/pharmacy/dashboard'] }
}

function initialsOf(name: string) {
  return name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function PharmacyLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, signOut } = useAuth()
  const role = usePharmacyRole()
  const pharmacyId = usePharmacyId()
  const { data: inventory } = usePharmacyInventory(pharmacyId || '')
  const { data: pharmacy, isLoading: pharmacyLoading } = usePharmacy(pharmacyId || '')

  const { meta } = matchRoute(location.pathname)
  const gated = role === 'staff' && !meta.staffVisible

  useEffect(() => {
    if (gated) {
      toast({
        title: 'Pharmacists only',
        description: `${meta.title} is available to pharmacists. You are signed in as counter staff.`,
      })
    }
  }, [gated, meta.title, toast])

  if (gated) {
    return <Navigate to="/pharmacy/dashboard" replace />
  }

  const lowStock = inventory?.filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_AT).length ?? 0
  const staffName = user?.email?.split('@')[0] || 'Staff'
  const pharmacyName = pharmacy?.name ?? ''
  const branch = [pharmacy?.city, pharmacy?.state].filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-screen bg-ground">
      <div className="hidden lg:block">
        <Sidebar
          active={meta.key}
          role={role}
          alertCounts={{ expiring: 0, lowStock }}
          pharmacyName={pharmacyName}
          branch={branch}
          isLoading={pharmacyLoading}
          staffName={staffName}
          staffInitials={initialsOf(staffName)}
          onSignOut={() => {
            signOut()
            navigate('/')
          }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <PharmacyTopBar title={meta.title} kicker={meta.kicker()} />
        <main className="px-4 pb-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
