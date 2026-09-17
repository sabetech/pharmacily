import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { usePharmacyId } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'
import { formatPrice } from '@/utils/helpers'
import type { InventoryItem } from '@/types'

interface CartLine {
  item: InventoryItem
  qty: number
}

export function Sell() {
  const pharmacyId = usePharmacyId()
  const { toast } = useToast()
  const { data: inventory, isLoading } = usePharmacyInventory(pharmacyId || '')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<'cash' | 'momo'>('cash')

  const results = (inventory || []).filter(
    (i) =>
      i.quantity > 0 &&
      (i.drug_name || '').toLowerCase().includes(query.trim().toLowerCase())
  )

  const addToCart = (item: InventoryItem) => {
    setCart((prev) => {
      const line = prev.find((l) => l.item.id === item.id)
      const inCart = line?.qty ?? 0
      if (inCart >= item.quantity) {
        toast({ title: 'No more in stock', description: `${item.drug_name} — ${item.quantity} left.` })
        return prev
      }
      if (line) {
        return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [...prev, { item, qty: 1 }]
    })
  }

  const setQty = (id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.item.id !== id)
        : prev.map((l) => {
            if (l.item.id !== id) return l
            const capped = Math.min(qty, l.item.quantity)
            return { ...l, qty: capped }
          })
    )
  }

  const subtotal = cart.reduce((sum, l) => sum + (l.item.price_cents ?? 0) * l.qty, 0)
  const count = cart.reduce((sum, l) => sum + l.qty, 0)

  const takePayment = () => {
    if (cart.length === 0) return
    toast({
      title: 'Checkout is not wired yet',
      description: 'Payment posting arrives with the sales API. The cart maths above is live.',
    })
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {/* Search + results */}
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="relative">
          <i
            className="ph ph-magnifying-glass pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[18px] text-live"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search counter stock..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[52px] rounded-full pl-12"
            autoComplete="off"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
                <div className="h-4 w-1/3 rounded bg-ground" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted">
              {query ? `No counter stock matches "${query}".` : 'Nothing in stock to sell yet.'}
            </CardContent>
          </Card>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3.5 rounded-row bg-card p-3 pr-4 shadow-resting"
            >
              <span className="icon-circle hidden h-12 w-12 rounded-field bg-stock-bg text-stock-label sm:grid">
                <i className="ph ph-pill text-[20px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-ink">{item.drug_name}</p>
                <p className="text-xs text-muted">
                  {item.drug_strength} {item.drug_form}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="tnum font-display text-base font-semibold text-ink">
                  {formatPrice(item.price_cents)}
                </p>
                <p className="tnum text-[11.5px] text-muted">{item.quantity} left</p>
              </div>
              <Button size="sm" onClick={() => addToCart(item)}>
                Add
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Current sale */}
      <div className="w-full flex-none lg:w-[384px]">
        <div className="flex flex-col overflow-hidden rounded-card bg-card shadow-floating">
          <div className="flex items-baseline gap-2.5 px-[22px] pb-3.5 pt-[22px]">
            <h2 className="font-display text-[19px] font-semibold text-ink">Current sale</h2>
            <span className="tnum text-xs text-muted">
              {count} item{count === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex min-h-0 flex-col gap-2 px-[22px]">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Tap Add on any row to start a sale.
              </p>
            ) : (
              cart.map((l) => (
                <div key={l.item.id} className="flex items-center gap-3 rounded-row bg-field p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{l.item.drug_name}</p>
                    <p className="tnum text-[11.5px] text-muted">
                      {formatPrice(l.item.price_cents)} each
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <button
                      onClick={() => setQty(l.item.id, l.qty - 1)}
                      className="grid h-[26px] w-[26px] place-items-center rounded-full bg-ground text-sm text-deep"
                      aria-label={`Remove one ${l.item.drug_name}`}
                    >
                      −
                    </button>
                    <span className="tnum min-w-4 text-center text-[13.5px] font-semibold">{l.qty}</span>
                    <button
                      onClick={() => setQty(l.item.id, l.qty + 1)}
                      className="grid h-[26px] w-[26px] place-items-center rounded-full bg-ground text-sm text-deep"
                      aria-label={`Add one ${l.item.drug_name}`}
                    >
                      +
                    </button>
                  </div>
                  <span className="tnum w-[74px] flex-none text-right text-[14.5px] font-semibold text-ink">
                    {formatPrice((l.item.price_cents ?? 0) * l.qty)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-[rgba(16,50,40,0.08)] p-[22px]">
            <div className="tnum flex justify-between text-[13px] text-[#3d5850]">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-[rgba(16,50,40,0.08)] pt-2.5">
              <span className="text-[13.5px] font-semibold text-ink">Total</span>
              <span className="tnum font-display text-[28px] font-semibold text-ink">
                {formatPrice(subtotal)}
              </span>
            </div>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => setMethod('cash')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full p-3 text-[13px] font-semibold ${
                  method === 'cash' ? 'bg-sales-bg text-sales-ink' : 'border border-[rgba(16,50,40,0.1)] bg-field text-[#3d5850]'
                }`}
              >
                <i className="ph ph-money text-[17px]" aria-hidden="true" /> Cash
              </button>
              <button
                onClick={() => setMethod('momo')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full p-3 text-[13px] ${
                  method === 'momo' ? 'bg-sales-bg font-semibold text-sales-ink' : 'border border-[rgba(16,50,40,0.1)] bg-field text-[#3d5850]'
                }`}
              >
                <i className="ph ph-device-mobile text-[17px]" aria-hidden="true" /> MoMo
              </button>
            </div>
            <Button size="lg" className="w-full" disabled={cart.length === 0} onClick={takePayment}>
              Take payment · {formatPrice(subtotal)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
