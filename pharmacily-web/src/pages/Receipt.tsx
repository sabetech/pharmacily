import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { getSale } from '@/lib/api'
import { formatPrice } from '@/utils/helpers'

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Receipt() {
  const { saleId } = useParams<{ saleId: string }>()
  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId!),
    enabled: !!saleId,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-card bg-card p-6 shadow-resting">
            <div className="h-4 w-1/3 rounded bg-ground" />
          </div>
        ))}
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="rounded-card bg-card p-10 text-center shadow-resting">
        <p className="text-sm text-muted">Sale not found.</p>
        <Link to="/pharmacy/sell" className="mt-3 inline-block font-semibold text-live">
          Back to Sell
        </Link>
      </div>
    )
  }

  const change =
    sale.amount_tendered_pesewas != null ? sale.amount_tendered_pesewas - sale.total_pesewas : null

  return (
    <div className="mx-auto w-full max-w-[440px]">
      <div className="flex flex-col overflow-hidden rounded-card bg-card shadow-floating">
        <div className="flex items-center gap-3 px-6 pb-4 pt-6">
          <span className="icon-circle grid h-11 w-11 place-items-center rounded-nav bg-deep text-[#f4faf1]">
            <i className="ph-fill ph-first-aid-kit text-[19px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[17px] font-semibold text-ink">
              {sale.pharmacy_name}
            </p>
            <p className="truncate text-xs text-muted">
              {sale.pharmacy_address}
              {sale.pharmacy_city ? `, ${sale.pharmacy_city}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-baseline justify-between border-t border-[rgba(16,50,40,0.08)] px-6 py-4">
          <span className="text-sm text-muted">Total paid</span>
          <span className="tnum font-display text-[30px] font-semibold text-ink">
            {formatPrice(sale.total_pesewas)}
          </span>
        </div>

        <div className="flex flex-col gap-2 px-6 pb-4">
          {sale.lines.map((l) => (
            <div key={l.id} className="flex items-start gap-3 rounded-row bg-field p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{l.drug_name}</p>
                  {l.is_rx && (
                    <span className="flex-none rounded-full bg-people-bg px-2 py-[2px] text-[11px] font-medium text-people-ink">
                      Rx
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-muted">
                  {l.strength} {l.form} · {formatPrice(l.unit_price_pesewas)} each
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="tnum text-[13.5px] font-semibold text-ink">×{l.quantity}</p>
                <p className="tnum text-[13px] text-muted">{formatPrice(l.line_total_pesewas)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-[rgba(16,50,40,0.08)] px-6 py-4 text-[13px]">
          <Row label="Method" value={sale.method === 'cash' ? 'Cash' : 'MoMo'} />
          {sale.amount_tendered_pesewas != null && (
            <Row label="Received" value={formatPrice(sale.amount_tendered_pesewas)} />
          )}
          {change != null && <Row label="Change" value={formatPrice(change)} />}
          <Row label="Sold by" value={sale.served_by_email || 'Counter'} />
          {sale.rx_confirmed && (
            <Row
              label="Rx prescriber"
              value={sale.rx_prescriber || '—'}
            />
          )}
          {sale.approved_by_email && (
            <Row label="Approved by" value={sale.approved_by_email} />
          )}
          <Row label="When" value={fmtTime(sale.created_at)} />
        </div>

        {sale.rx_confirmed && (
          <div className="mx-6 mb-4 flex items-start gap-2.5 rounded-row bg-expiry-tint p-3">
            <i className="ph ph-file-text mt-[2px] text-[17px] text-expiry-label" aria-hidden="true" />
            <p className="text-[12.5px] leading-snug text-expiry-ink">
              Prescription supply. Prescriber {sale.rx_prescriber || '—'}.
              {sale.approved_by_email ? ` Approved by ${sale.approved_by_email}.` : ''}
            </p>
          </div>
        )}

        <div className="border-t border-[rgba(16,50,40,0.08)] p-[22px]">
          <Link
            to="/pharmacy/sell"
            className="block w-full rounded-full bg-deep py-3 text-center text-sm font-semibold text-[#f4faf1]"
          >
            Back to Sell
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tnum flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}
