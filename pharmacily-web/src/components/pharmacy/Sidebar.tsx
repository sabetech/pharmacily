import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { cn } from '@/utils/helpers'
import type { PharmacyRole } from '@/hooks/usePharmacyRole'

export type SidebarKey =
  | 'dashboard'
  | 'sell'
  | 'drugs'
  | 'stock-take'
  | 'alerts'
  | 'suppliers'
  | 'reports'

export interface AlertCounts {
  expiring: number
  lowStock: number
}

interface SidebarItem {
  key: SidebarKey
  label: string
  to: string
  icon: string
  staffVisible: boolean
}

const ITEMS: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/pharmacy/dashboard', icon: 'ph-house', staffVisible: true },
  { key: 'sell', label: 'Sell', to: '/pharmacy/sell', icon: 'ph-shopping-cart', staffVisible: true },
  { key: 'drugs', label: 'Manage drugs', to: '/pharmacy/drugs', icon: 'ph-pill', staffVisible: true },
  { key: 'stock-take', label: 'Take stock', to: '/pharmacy/stock-take', icon: 'ph-clipboard-text', staffVisible: true },
  { key: 'alerts', label: 'Alerts', to: '/pharmacy/alerts', icon: 'ph-bell', staffVisible: true },
  { key: 'suppliers', label: 'Suppliers', to: '/pharmacy/suppliers', icon: 'ph-truck', staffVisible: false },
  { key: 'reports', label: 'Reports', to: '/pharmacy/reports', icon: 'ph-chart-bar', staffVisible: false },
]

function CountPill({ value, className, label }: { value: number; className: string; label: string }) {
  if (value <= 0) return null
  return (
    <span
      className={cn('tnum rounded-full px-[9px] py-[2px] text-[11px] font-semibold', className)}
      aria-label={label}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

export interface SidebarProps {
  active: SidebarKey
  role: PharmacyRole
  alertCounts: AlertCounts
  pharmacyName: string
  branch: string
  isLoading?: boolean
  staffName: string
  staffInitials: string
  onSignOut: () => void
}

export function Sidebar({
  active,
  role,
  alertCounts,
  pharmacyName,
  branch,
  isLoading = false,
  staffName,
  staffInitials,
  onSignOut,
}: SidebarProps) {
  const visible = ITEMS.filter((item) => role === 'pharmacist' || item.staffVisible)

  return (
    <aside className="flex h-screen w-[236px] flex-none flex-col bg-card pb-4 pl-3 pr-3 pt-5">
      <div className="px-3 pb-5 pt-1">
        <Logo size={36} />
      </div>

      <nav aria-label="Pharmacy" className="flex-1 space-y-1 overflow-y-auto">
        {visible.map((item) => {
          const isActive = item.key === active
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-[11px] rounded-nav px-[14px] py-[10px] text-[13.5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live focus-visible:ring-offset-2',
                isActive
                  ? 'bg-deep font-semibold text-[#f4faf1]'
                  : 'font-medium text-[#3d5850] hover:bg-field hover:text-live'
              )}
            >
              {isActive ? (
                <i className={`ph-fill ${item.icon} text-[17px]`} aria-hidden="true" />
              ) : (
                <span className="icon-circle h-[26px] w-[26px]">
                  <i className={`${item.icon} text-[15px]`} aria-hidden="true" />
                </span>
              )}
              <span>{item.label}</span>
              {item.key === 'alerts' && (
                <span className="ml-auto flex gap-1">
                  <CountPill
                    value={alertCounts.expiring}
                    className="bg-expiry-bg text-expiry-ink"
                    label={`${alertCounts.expiring} expiring items`}
                  />
                  <CountPill
                    value={alertCounts.lowStock}
                    className="bg-people-bg text-people-ink"
                    label={`${alertCounts.lowStock} low stock items`}
                  />
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pt-4" aria-busy={isLoading || undefined}>
        {isLoading ? (
          <>
            <div className="h-4 w-3/4 animate-pulse rounded-field bg-field" aria-hidden="true" />
            <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded-field bg-field" aria-hidden="true" />
            <span className="sr-only">Loading pharmacy</span>
          </>
        ) : (
          <>
            {pharmacyName && (
              <p className="font-display text-sm font-semibold text-ink">{pharmacyName}</p>
            )}
            {branch && <p className="label-micro mt-0.5">{branch}</p>}
          </>
        )}
        <div className="mt-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-people-bg text-[12.5px] font-semibold text-people-ink">
            {staffInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{staffName}</p>
            <p className="text-[11px] text-muted">{role === 'pharmacist' ? 'Pharmacist' : 'Counter staff'}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="mt-2 text-[13px] font-semibold text-live hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
