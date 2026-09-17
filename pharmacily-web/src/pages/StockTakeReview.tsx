import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { usePharmacyId, usePharmacyRole } from '@/hooks/usePharmacyRole'
import { useToast } from '@/hooks/useToast'
import { getSession, getLines, decideSession } from '@/lib/stockTake'
import { updateInventoryQuantity } from '@/lib/inventory'
import { supabase } from '@/lib/supabase'
import { cn } from '@/utils/helpers'

export function StockTakeReview() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = usePharmacyRole()
  const pharmacyId = usePharmacyId()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: session, isLoading } = useQuery({
    queryKey: ['stock-take', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
  })
  const { data: lines } = useQuery({
    queryKey: ['stock-take', sessionId, 'lines'],
    queryFn: () => getLines(sessionId!),
    enabled: !!sessionId,
  })

  const decide = useMutation({
    mutationFn: async (decision: 'approved' | 'rejected') => {
      if (decision === 'approved') {
        // Post counted quantities to inventory (RLS: own pharmacy only)
        const { data: inv, error } = await supabase
          .from('inventory')
          .select('id, drug_id')
          .eq('pharmacy_id', pharmacyId!)
        if (error) throw error
        const byDrug = new Map((inv || []).map((r: any) => [r.drug_id, r.id]))
        for (const line of lines || []) {
          if (line.counted_qty === null) continue
          const invId = byDrug.get(line.drug_id)
          if (invId) {
            await updateInventoryQuantity(invId, pharmacyId!, line.counted_qty)
          }
        }
        queryClient.invalidateQueries({ queryKey: ['pharmacies', pharmacyId, 'inventory'] })
      }
      await decideSession(sessionId!, decision, user!.id)
    },
    onSuccess: (_, decision) => {
      queryClient.invalidateQueries({ queryKey: ['stock-take'] })
      toast({
        title: decision === 'approved' ? 'Variances posted' : 'Count rejected',
        description:
          decision === 'approved'
            ? 'Inventory now matches the counted quantities.'
            : 'The session is back to draft for a recount.',
      })
      navigate('/pharmacy/stock-take')
    },
    onError: (e: Error) =>
      toast({ title: 'Could not decide', description: e.message, variant: 'destructive' }),
  })

  useEffect(() => {
    if (role === 'staff') {
      toast({
        title: 'Pharmacists only',
        description: 'Variance review needs a pharmacist account. Your counts are saved on the sheet.',
      })
    }
  }, [role, toast])

  if (role === 'staff') {
    return <Navigate to={`/pharmacy/stock-take/${sessionId}`} replace />
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
            <div className="h-4 w-1/3 rounded bg-ground" />
          </div>
        ))}
      </div>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted">Count session not found.</CardContent>
      </Card>
    )
  }

  const variances = (lines || [])
    .map((l) => ({ ...l, delta: (l.counted_qty ?? l.system_qty) - l.system_qty }))
    .filter((l) => l.counted_qty !== null && l.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const uncounted = (lines || []).filter((l) => l.counted_qty === null).length
  const decided = session.status === 'approved' || session.status === 'rejected'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={session.status === 'submitted' ? 'lowstock' : session.status === 'approved' ? 'instock' : 'expiry'}>
          {session.status}
        </Badge>
        <span className="tnum text-sm text-muted">
          {variances.length} variance{variances.length === 1 ? '' : 's'}
          {uncounted > 0 ? ` · ${uncounted} uncounted` : ''}
        </span>
        <span className="flex-1" />
        <Link to={`/pharmacy/stock-take/${session.id}`}>
          <Button size="sm" variant="outline">
            Back to sheet
          </Button>
        </Link>
      </div>

      {uncounted > 0 && !decided && (
        <div className="flex items-center gap-2 rounded-row bg-sales-bg p-3 text-sm text-sales-ink">
          <i className="ph ph-info text-base" aria-hidden="true" />
          <span>{uncounted} lines have no count. Uncounted lines keep their system quantity on approval.</span>
        </div>
      )}

      {variances.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-stock-bg text-stock-label">
              <i className="ph ph-check-circle text-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mb-2 font-display text-lg font-semibold text-ink">No variances</h3>
            <p className="text-sm text-muted">Every counted line matches the system quantity.</p>
          </CardContent>
        </Card>
      ) : (
        variances.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-3.5 rounded-row bg-card p-3 pr-4 shadow-resting"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold text-ink">{v.drug_name}</p>
              <p className="tnum text-xs text-muted">
                System {v.system_qty} · counted {v.counted_qty}
              </p>
            </div>
            <span
              className={cn(
                'tnum rounded-full px-3 py-[5px] text-xs font-semibold',
                v.delta < 0 ? 'bg-expiry-bg text-expiry-ink' : 'bg-stock-bg text-stock-ink'
              )}
            >
              {v.delta > 0 ? `+${v.delta}` : v.delta}
            </span>
          </div>
        ))
      )}

      {!decided && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate('rejected')}
          >
            Reject — send back for recount
          </Button>
          <Button disabled={decide.isPending} onClick={() => decide.mutate('approved')}>
            {decide.isPending ? 'Posting...' : `Approve and post ${variances.length} variance${variances.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}
    </div>
  )
}
