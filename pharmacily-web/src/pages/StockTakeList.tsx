import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { usePharmacyId, usePharmacyRole } from '@/hooks/usePharmacyRole'
import { usePharmacyInventory } from '@/hooks/useQueries'
import { useToast } from '@/hooks/useToast'
import { listSessions, startSession, type StockTakeStatus } from '@/lib/stockTake'

const STATUS_PILL: Record<StockTakeStatus, 'otc' | 'lowstock' | 'instock' | 'expiry'> = {
  draft: 'otc',
  submitted: 'lowstock',
  approved: 'instock',
  rejected: 'expiry',
}

const STATUS_LABEL: Record<StockTakeStatus, string> = {
  draft: 'Counting',
  submitted: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function StockTakeList() {
  const pharmacyId = usePharmacyId()
  const role = usePharmacyRole()
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['stock-take', pharmacyId],
    queryFn: () => listSessions(pharmacyId!),
    enabled: !!pharmacyId,
    staleTime: 30 * 1000,
  })
  const { data: inventory } = usePharmacyInventory(pharmacyId || '')

  const start = useMutation({
    mutationFn: () =>
      startSession(
        pharmacyId!,
        user!.id,
        (inventory || []).map((i) => ({ drug_id: i.drug_id, system_qty: i.quantity }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take', pharmacyId] })
      toast({ title: 'Count started', description: 'System quantities snapshotted. Start counting.' })
    },
    onError: (e: Error) =>
      toast({ title: 'Could not start count', description: e.message, variant: 'destructive' }),
  })

  const openDraft = sessions?.find((s) => s.status === 'draft')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="tnum text-sm text-muted">
          {(inventory || []).length} stocked drugs
          {openDraft ? ' · one count in progress' : ''}
        </p>
        <span className="flex-1" />
        {openDraft ? (
          <Link to={`/pharmacy/stock-take/${openDraft.id}`}>
            <Button size="sm" variant="secondary">
              Continue count
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            disabled={starting || start.isPending}
            onClick={() => {
              setStarting(true)
              start.mutate(undefined, { onSettled: () => setStarting(false) })
            }}
          >
            <i className="ph ph-plus mr-1" aria-hidden="true" />
            {starting ? 'Starting...' : 'Start count'}
          </Button>
        )}
      </div>

      {role === 'staff' && (
        <p className="text-[13px] text-muted">
          You enter counts. A pharmacist reviews variances and approves before stock changes.
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
              <div className="h-4 w-1/4 rounded bg-ground" />
            </div>
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-stock-bg text-stock-label">
              <i className="ph ph-clipboard-text text-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">No counts yet</h3>
            <p className="mx-auto mb-2 max-w-md text-sm text-muted">
              Start a count to snapshot system quantities, walk the shelves, then submit for pharmacist
              approval. Approved variances post straight to stock.
            </p>
          </CardContent>
        </Card>
      ) : (
        sessions.map((s) => (
          <Link
            key={s.id}
            to={s.status === 'draft' ? `/pharmacy/stock-take/${s.id}` : `/pharmacy/stock-take/${s.id}/review`}
            className="flex items-center gap-3.5 rounded-row bg-card p-4 shadow-resting"
          >
            <span className="icon-circle h-[46px] w-[46px] flex-none rounded-field bg-field text-deep">
              <i className="ph ph-clipboard-text text-[20px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="tnum text-[14.5px] font-semibold text-ink">
                Count · {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className="tnum text-xs text-muted">
                {new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant={STATUS_PILL[s.status]}>{STATUS_LABEL[s.status]}</Badge>
          </Link>
        ))
      )}
    </div>
  )
}
