import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StockPill } from '@/components/pharmacy/StockPill'
import { LOW_STOCK_AT } from '@/components/pharmacy/PharmacyLayout'
import { usePharmacyId, usePharmacyRole } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'
import { formatPrice } from '@/utils/helpers'
import { cn } from '@/utils/helpers'

type Tab = 'expiring' | 'low'

export function Alerts() {
  const pharmacyId = usePharmacyId()
  const role = usePharmacyRole()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('expiring')
  const { data: inventory, isLoading } = usePharmacyInventory(pharmacyId || '')

  const low = (inventory || [])
    .filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_AT)
    .sort((a, b) => a.quantity - b.quantity)

  const reorder = (name: string) => {
    if (role !== 'pharmacist') {
      toast({ title: 'Pharmacists only', description: 'Reordering needs a pharmacist account.' })
      return
    }
    toast({ title: 'Reorder noted', description: `${name} — purchase orders arrive with Suppliers.` })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex rounded-full bg-ground p-[3px] shadow-resting md:w-max">
        <button
          onClick={() => setTab('expiring')}
          className={cn(
            'flex-1 rounded-full px-4 py-[7px] text-[12.5px] font-semibold md:flex-none md:px-6',
            tab === 'expiring' ? 'bg-deep text-[#f4faf1]' : 'text-muted'
          )}
        >
          Expiring 0
        </button>
        <button
          onClick={() => setTab('low')}
          className={cn(
            'flex-1 rounded-full px-4 py-[7px] text-[12.5px] font-semibold md:flex-none md:px-6',
            tab === 'low' ? 'bg-deep text-[#f4faf1]' : 'text-muted'
          )}
        >
          Low stock {low.length}
        </button>
      </div>

      {role === 'staff' && (
        <p className="text-[13px] text-muted">
          Counter staff see this list read-only. Write-offs need a pharmacist.
        </p>
      )}

      {tab === 'expiring' && (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-expiry-bg text-expiry-label">
              <i className="ph ph-clock text-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">No expiry data yet</h3>
            <p className="mx-auto max-w-md text-sm text-muted">
              Batch numbers and expiry dates arrive with the catalogue upgrade. Until then, expiry
              triage lives here and the badge stays hidden.
            </p>
          </CardContent>
        </Card>
      )}

      {tab === 'low' && (
        <>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
                  <div className="h-4 w-1/3 rounded bg-ground" />
                </div>
              ))}
            </div>
          ) : low.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-stock-bg text-stock-label">
                  <i className="ph ph-check-circle text-[22px]" aria-hidden="true" />
                </span>
                <h3 className="mb-2 font-display text-lg font-semibold text-ink">Shelves look healthy</h3>
                <p className="text-sm text-muted">Nothing is below the reorder level of {LOW_STOCK_AT}.</p>
              </CardContent>
            </Card>
          ) : (
            low.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3.5 rounded-row bg-card p-3 pr-4 shadow-resting"
              >
                <span className="icon-circle hidden h-[46px] w-[46px] flex-none rounded-field bg-people-bg text-people-label sm:grid">
                  <i className="ph ph-package text-[20px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{item.drug_name}</p>
                  <p className="tnum text-xs text-muted">
                    {item.quantity} left · {formatPrice(item.price_cents)} each
                  </p>
                </div>
                <StockPill quantity={item.quantity} className="hidden sm:inline-flex" />
                <Button size="sm" onClick={() => reorder(item.drug_name || 'Drug')}>
                  Reorder
                </Button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
