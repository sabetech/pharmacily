import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { LOW_STOCK_AT } from '@/components/pharmacy/PharmacyLayout'
import { usePharmacyId } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { getSalesSummary } from '@/lib/api'
import { formatPrice } from '@/utils/helpers'

export function Reports() {
  const pharmacyId = usePharmacyId()
  const { data: inventory } = usePharmacyInventory(pharmacyId || '')
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['sales-summary', pharmacyId],
    queryFn: () => getSalesSummary('today'),
    enabled: !!pharmacyId,
  })

  const items = inventory || []
  const units = items.reduce((s, i) => s + i.quantity, 0)
  const stockValue = items.reduce((s, i) => s + i.quantity * (i.price_cents ?? 0), 0)
  const low = items.filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_AT).length
  const salesToday = summary?.total_pesewas ?? 0
  const txToday = summary?.transactions ?? 0

  return (
    <div className="flex flex-col gap-5">
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
          <p className="label-micro text-expiry-label">Sales · today</p>
          <p className="tnum mt-2.5 font-display text-[28px] font-semibold text-expiry-ink">
            {summaryLoading ? '…' : formatPrice(salesToday)}
          </p>
          <p className="tnum mt-0.5 text-xs text-expiry-label">
            {txToday === 0
              ? 'no sales recorded yet'
              : `${txToday} transaction${txToday === 1 ? '' : 's'} today`}
          </p>
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
