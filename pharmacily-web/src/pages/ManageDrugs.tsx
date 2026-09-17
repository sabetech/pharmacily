import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StockPill } from '@/components/pharmacy/StockPill'
import { LOW_STOCK_AT } from '@/components/pharmacy/PharmacyLayout'
import { usePharmacyId, usePharmacyRole } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory, useDrugSearch } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'
import { upsertInventoryRow, updateInventoryQuantity } from '@/lib/inventory'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatPrice } from '@/utils/helpers'
import { cn } from '@/utils/helpers'
import type { DrugSearchResult } from '@/types'

type Filter = 'all' | 'low'

export function ManageDrugs() {
  const pharmacyId = usePharmacyId()
  const role = usePharmacyRole()
  const canEdit = role === 'pharmacist'
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: inventory, isLoading } = usePharmacyInventory(pharmacyId || '')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['pharmacies', pharmacyId, 'inventory'] })

  const adjust = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) =>
      updateInventoryQuantity(id, pharmacyId!, Math.max(0, qty)),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: 'Could not update stock', description: e.message, variant: 'destructive' }),
  })

  const rows = (inventory || []).filter((i) => {
    if (filter === 'low' && !(i.quantity > 0 && i.quantity <= LOW_STOCK_AT)) return false
    return (i.drug_name || '').toLowerCase().includes(query.trim().toLowerCase())
  })
  const lowCount = (inventory || []).filter((i) => i.quantity > 0 && i.quantity <= LOW_STOCK_AT).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All {inventory?.length ?? 0}
          </FilterChip>
          <FilterChip active={filter === 'low'} onClick={() => setFilter('low')}>
            Low stock {lowCount}
          </FilterChip>
        </div>
        <span className="flex-1" />
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <i className="ph ph-plus mr-1" aria-hidden="true" /> Add drug
          </Button>
        )}
      </div>

      <div className="relative">
        <i
          className="ph ph-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 rounded-full pl-11"
          autoComplete="off"
        />
      </div>

      {!canEdit && (
        <p className="text-[13px] text-muted">
          You are signed in as counter staff. Stock edits appear here for pharmacists only.
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
              <div className="h-4 w-1/3 rounded bg-ground" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            {query || filter === 'low' ? 'Nothing matches these filters.' : 'No drugs on record yet.'}
          </CardContent>
        </Card>
      ) : (
        rows.map((item) => {
          const trouble = item.quantity <= LOW_STOCK_AT
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3.5 rounded-row p-3 pr-4 shadow-resting',
                trouble ? 'bg-expiry-tint' : 'bg-card'
              )}
            >
              <span
                className={cn(
                  'icon-circle hidden h-[46px] w-[46px] rounded-field sm:grid',
                  trouble ? 'bg-expiry-bg text-expiry-label' : 'bg-stock-bg text-stock-label'
                )}
              >
                <i className="ph ph-pill text-[20px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-ink">{item.drug_name}</p>
                <p className="truncate text-xs text-muted">
                  {item.drug_generic_name} {item.drug_strength} {item.drug_form}
                </p>
              </div>
              <div className="hidden flex-none text-right sm:block">
                <p className="tnum font-display text-[17px] font-semibold text-ink">
                  {formatPrice(item.price_cents)}
                </p>
                <p className="tnum text-[11.5px] text-muted">{item.quantity} left</p>
              </div>
              <StockPill quantity={item.quantity} className="hidden md:inline-flex" />
              {canEdit && (
                <div className="flex flex-none items-center gap-1.5">
                  <button
                    onClick={() => adjust.mutate({ id: item.id, qty: item.quantity - 1 })}
                    disabled={item.quantity <= 0 || adjust.isPending}
                    className="grid h-10 w-10 place-items-center rounded-full bg-ground text-deep disabled:opacity-40"
                    aria-label={`Remove one ${item.drug_name}`}
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjust.mutate({ id: item.id, qty: item.quantity + 1 })}
                    disabled={adjust.isPending}
                    className="grid h-10 w-10 place-items-center rounded-full bg-ground text-deep disabled:opacity-40"
                    aria-label={`Add one ${item.drug_name}`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })
      )}

      {adding && (
        <AddDrugModal
          pharmacyId={pharmacyId!}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            invalidate()
          }}
        />
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'tnum rounded-full px-[18px] py-[9px] text-[13px]',
        active ? 'bg-deep font-semibold text-[#f4faf1]' : 'bg-card text-[#3d5850] shadow-resting'
      )}
    >
      {children}
    </button>
  )
}

function AddDrugModal({
  pharmacyId,
  onClose,
  onSaved,
}: {
  pharmacyId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<DrugSearchResult | null>(null)
  const [showList, setShowList] = useState(false)
  const [qty, setQty] = useState('0')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 300)
  const { data: matches, isLoading } = useDrugSearch(debouncedSearch)

  const save = async () => {
    if (!selected) {
      toast({ title: 'Pick a drug', description: 'Search the catalogue and choose a match.' })
      return
    }
    const quantity = parseInt(qty, 10)
    const priceCents = price.trim() === '' ? null : Math.round(parseFloat(price) * 100)
    if (!Number.isInteger(quantity) || quantity < 0) {
      toast({ title: 'Check quantity', description: 'Quantity must be a whole number, 0 or more.', variant: 'destructive' })
      return
    }
    if (priceCents === null || !(priceCents > 0)) {
      toast({ title: 'Check price', description: 'Selling price must be more than Gh₵ 0.00.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await upsertInventoryRow(pharmacyId, selected.id, quantity, priceCents)
      toast({ title: 'Drug saved', description: `${selected.name} is now visible to the locator.` })
      onSaved()
    } catch (e) {
      toast({
        title: 'Could not save',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,64,52,0.32)] p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card bg-card p-6 shadow-modal">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-micro">New record</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">Add drug</h2>
          </div>
          <button onClick={onClose} className="icon-circle h-10 w-10" aria-label="Close">
            <i className="ph ph-x text-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="relative">
            <Label htmlFor="drug-search">Drug name</Label>
            <Input
              id="drug-search"
              placeholder="Start typing, e.g. amox..."
              value={selected ? selected.name : search}
              onChange={(e) => {
                setSelected(null)
                setSearch(e.target.value)
                setShowList(true)
              }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 200)}
              className="mt-1.5"
              autoComplete="off"
            />
            {showList && (matches || isLoading) && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-56 overflow-auto rounded-row bg-card shadow-floating">
                {isLoading ? (
                  <p className="p-4 text-center text-sm text-muted">Searching catalogue...</p>
                ) : matches && matches.length > 0 ? (
                  matches.map((d) => (
                    <button
                      key={d.id}
                      onMouseDown={() => {
                        setSelected(d)
                        setShowList(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-field"
                    >
                      <span className="icon-circle h-9 w-9">
                        <i className="ph ph-pill text-[17px]" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">{d.name}</span>
                        <span className="block text-xs text-muted">
                          {d.generic_name} {d.strength} {d.form}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-center text-sm text-muted">No catalogue match. Ask for it to be added.</p>
                )}
              </div>
            )}
          </div>

          {selected && (
            <Badge variant="otc">
              {selected.generic_name} {selected.strength} {selected.form}
            </Badge>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="qty">Stock quantity</Label>
              <Input id="qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="tnum mt-1.5" />
            </div>
            <div>
              <Label htmlFor="price">Selling price (Gh₵)</Label>
              <Input id="price" inputMode="decimal" placeholder="24.00" value={price} onChange={(e) => setPrice(e.target.value)} className="tnum mt-1.5" />
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <Button onClick={save} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save drug'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
