import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePharmacyId, usePharmacyRole } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'
import { createSale, ApiError } from '@/lib/api'
import { formatPrice } from '@/utils/helpers'
import type { InventoryItem } from '@/types'

interface CartLine {
  item: InventoryItem
  qty: number
}

const isRxItem = (item: InventoryItem) => item.rx_otc === 'Rx'

export function Sell() {
  const pharmacyId = usePharmacyId()
  const role = usePharmacyRole()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: inventory, isLoading } = usePharmacyInventory(pharmacyId || '')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<'cash' | 'momo'>('cash')
  const [tendered, setTendered] = useState('')
  const [showRxModal, setShowRxModal] = useState(false)
  const [rxPrescriber, setRxPrescriber] = useState('')
  const [posting, setPosting] = useState(false)

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

  const cartRxLines = cart.filter((l) => isRxItem(l.item))
  const hasRx = cartRxLines.length > 0
  const subtotal = cart.reduce((sum, l) => sum + (l.item.price_cents ?? 0) * l.qty, 0)
  const count = cart.reduce((sum, l) => sum + l.qty, 0)
  const tenderedNum = Number(tendered)
  const tenderedValid =
    method === 'momo' || (tendered !== '' && Number.isFinite(tenderedNum) && tenderedNum >= subtotal)
  const change = method === 'cash' && tenderedValid ? tenderedNum - subtotal : 0

  const doCheckout = async (rxConfirmed: boolean, prescriber: string) => {
    if (cart.length === 0 || posting) return
    setPosting(true)
    try {
      const result = await createSale({
        lines: cart.map((l) => ({ inventory_id: l.item.id, quantity: l.qty })),
        method,
        rx_confirmed: rxConfirmed,
        rx_prescriber: prescriber || undefined,
      })
      setCart([])
      setTendered('')
      setRxPrescriber('')
      toast({
        title: 'Payment taken',
        description: `${formatPrice(result.sale.total_pesewas)} recorded.`,
      })
      navigate(`/pharmacy/receipt/${result.sale.id}`)
    } catch (err) {
      const detail = err instanceof ApiError && err.details ? ` — ${err.details}` : ''
      toast({
        title: 'Sale not recorded',
        description: `${err instanceof Error ? err.message : 'Something went wrong'}${detail}`,
      })
    } finally {
      setPosting(false)
    }
  }

  const takePayment = () => {
    if (cart.length === 0) return
    if (hasRx) {
      if (role !== 'pharmacist') {
        toast({
          title: 'Pharmacist approval needed',
          description: 'A prescription item is in the cart. Ask the pharmacist on duty to approve.',
        })
      }
      setShowRxModal(true)
      return
    }
    doCheckout(false, '')
  }

  const confirmRx = () => {
    if (!rxPrescriber.trim()) {
      toast({ title: 'Prescriber required', description: "Record who wrote the prescription." })
      return
    }
    if (role !== 'pharmacist') {
      toast({
        title: 'Pharmacist approval needed',
        description: 'Only a pharmacist can approve an Rx sale.',
      })
      return
    }
    setShowRxModal(false)
    doCheckout(true, rxPrescriber.trim())
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
          <div className="rounded-card bg-card py-10 text-center text-sm text-muted shadow-resting">
            {query ? `No counter stock matches "${query}".` : 'Nothing in stock to sell yet.'}
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3.5 rounded-row bg-card p-3 pr-4 shadow-resting"
            >
              <span
                className={`icon-circle hidden h-12 w-12 rounded-field text-[20px] sm:grid ${
                  isRxItem(item) ? 'bg-people-bg text-people-ink' : 'bg-stock-bg text-stock-label'
                }`}
              >
                <i className="ph ph-pill" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{item.drug_name}</p>
                  {isRxItem(item) && (
                    <Badge variant="rx" className="flex-none">
                      Rx
                    </Badge>
                  )}
                </div>
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
                <div
                  key={l.item.id}
                  className={`flex items-center gap-3 rounded-row p-3 ${
                    isRxItem(l.item) ? 'bg-expiry-tint' : 'bg-field'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13.5px] font-semibold text-ink">
                        {l.item.drug_name}
                      </p>
                      {isRxItem(l.item) && (
                        <Badge variant="rx" className="flex-none">
                          Rx
                        </Badge>
                      )}
                    </div>
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
                    <span className="tnum min-w-4 text-center text-[13.5px] font-semibold">
                      {l.qty}
                    </span>
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

          {hasRx && (
            <div className="mx-[22px] mt-3 flex items-start gap-2.5 rounded-row bg-expiry-tint p-3">
              <i className="ph ph-file-text mt-[2px] text-[17px] text-expiry-label" aria-hidden="true" />
              <p className="text-[12.5px] leading-snug text-expiry-ink">
                {cartRxLines.length} prescription item{cartRxLines.length === 1 ? '' : 's'} in this sale.
                {role === 'pharmacist'
                  ? ' Confirm the prescriber when you take payment.'
                  : ' A pharmacist on duty must approve at checkout.'}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[rgba(16,50,40,0.08)] p-[22px]">
            <div className="tnum flex justify-between text-[13px] text-[#3d5850]">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {method === 'cash' && cart.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tendered" className="text-[12.5px] text-muted">
                  Cash received
                </label>
                <Input
                  id="tendered"
                  type="number"
                  inputMode="decimal"
                  min={subtotal}
                  step="0.01"
                  placeholder={String(subtotal)}
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="tnum rounded-field"
                />
                {tenderedValid && (
                  <p className="tnum text-[12.5px] text-stock-ink">Change · {formatPrice(change)}</p>
                )}
              </div>
            )}

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
                  method === 'cash'
                    ? 'bg-sales-bg text-sales-ink'
                    : 'border border-[rgba(16,50,40,0.1)] bg-field text-[#3d5850]'
                }`}
              >
                <i className="ph ph-money text-[17px]" aria-hidden="true" /> Cash
              </button>
              <button
                onClick={() => setMethod('momo')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full p-3 text-[13px] ${
                  method === 'momo'
                    ? 'bg-sales-bg font-semibold text-sales-ink'
                    : 'border border-[rgba(16,50,40,0.1)] bg-field text-[#3d5850]'
                }`}
              >
                <i className="ph ph-device-mobile text-[17px]" aria-hidden="true" /> MoMo
              </button>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={cart.length === 0 || posting || !tenderedValid}
              onClick={takePayment}
            >
              {posting ? 'Recording…' : hasRx ? 'Pharmacist approval' : `Take payment · ${formatPrice(subtotal)}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Rx approval modal */}
      {showRxModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,50,40,0.28)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pharmacist approval"
        >
          <div className="w-full max-w-[420px] rounded-card bg-card p-6 shadow-modal">
            <h3 className="font-display text-[20px] font-semibold text-ink">Pharmacist approval</h3>
            <p className="mt-1.5 text-sm text-muted">
              This sale includes prescription items. The pharmacist on duty confirms the prescriber
              and takes responsibility for the Rx supply.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {cartRxLines.map((l) => (
                <div key={l.item.id} className="flex items-center gap-2 rounded-row bg-field px-3 py-2">
                  <Badge variant="rx" className="flex-none">
                    Rx
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {l.item.drug_name} {l.item.drug_strength}
                  </span>
                  <span className="tnum text-[13px] text-muted">×{l.qty}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <label htmlFor="prescriber" className="text-[12.5px] text-muted">
                Prescriber
              </label>
              <Input
                id="prescriber"
                placeholder="e.g. Dr. Mensah, Ridge Clinic"
                value={rxPrescriber}
                onChange={(e) => setRxPrescriber(e.target.value)}
                className="rounded-field"
              />
            </div>

            {role !== 'pharmacist' && (
              <p className="mt-3 flex items-start gap-2 text-[12.5px] text-expiry-ink">
                <i className="ph ph-lock mt-[1px]" aria-hidden="true" />
                Only a pharmacist account can approve. Hand the device over to continue.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowRxModal(false)
                  setRxPrescriber('')
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!rxPrescriber.trim() || role !== 'pharmacist' || posting}
                onClick={confirmRx}
              >
                {posting ? 'Recording…' : 'Approve & charge'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
