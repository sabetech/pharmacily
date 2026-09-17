import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { LOW_STOCK_AT } from '@/components/pharmacy/PharmacyLayout'
import { usePharmacyId } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { formatPrice } from '@/utils/helpers'
import { cn } from '@/utils/helpers'

type Range = 'today' | '7d' | '14d' | 'month'

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: 'month', label: 'Month' },
]

export function Reports() {
  const pharmacyId = usePharmacyId()
  const [range, setRange] = useState<Range>('14d')
  const { data: inventory } = usePharmacyInventory(pharmacyId || '')

  const items = inventory || []
  const units = items.reduce((s, i) => s + i.quantity, 0)
  const stockValue = items.reduce((s, i) => s + i.quantity * (i.price_cents ?? 0), 0)
  const low = items.filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_AT).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex rounded-full bg-ground p-[3px] shadow-resting md:w-max">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              'flex-1 rounded-full px-4 py-[7px] text-[12.5px] md:flex-none md:px-5',
              range === r.key ? 'bg-deep font-semibold text-[#f4faf1]' : 'text-[#3d5850]'
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-card bg-sales-bg p-[22px]">
          <p className="label-micro text-sales-label">Stock value</p>
          <p className="tnum mt-2.5 font-display text-[28px] font-semibold text-sales-ink">
            {formatPrice(stockValue)}
          </p>
          <p className="tnum mt-0.5 text-xs text-sales-label">at selling price</p>
        </div>
        <div className="rounded-card bg-stock-bg p-[22px]">
          <p className="label-micro text-stock-label">Units on shelf</p>
          <p className="tnum mt-2.5 font-display text-[28px] font-semibold text-stock-ink">
            {units.toLocaleString()}
          </p>
          <p className="tnum mt-0.5 text-xs text-stock-label">{items.length} drugs stocked</p>
        </div>
        <div className="rounded-card bg-people-bg p-[22px]">
          <p className="label-micro text-people-label">Low stock</p>
          <p className="tnum mt-2.5 font-display text-[28px] font-semibold text-people-ink">{low}</p>
          <p className="mt-0.5 text-xs text-people-label">below {LOW_STOCK_AT} units</p>
        </div>
        <div className="rounded-card bg-expiry-bg p-[22px]">
          <p className="label-micro text-expiry-label">Sales · {RANGES.find((r) => r.key === range)?.label}</p>
          <p className="tnum mt-2.5 font-display text-[28px] font-semibold text-expiry-ink">—</p>
          <p className="mt-0.5 text-xs text-expiry-label">no sales recorded yet</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <span className="icon-circle mx-auto mb-4 h-12 w-12">
            <i className="ph ph-chart-bar text-[22px]" aria-hidden="true" />
          </span>
          <h3 className="mb-2 font-display text-lg font-semibold text-ink">Sales charts arrive next</h3>
          <p className="mx-auto max-w-md text-sm text-muted">
            Daily bars, top sellers, and category splits light up once the first sale posts through
            checkout.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
