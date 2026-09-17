import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { usePharmacyRole } from '@/hooks/usePharmacyRole'
import { useToast } from '@/hooks/useToast'
import { getSession, getLines, saveCountedQty, submitSession } from '@/lib/stockTake'

export function StockTakeSheet() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const role = usePharmacyRole()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('')

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['stock-take', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
  })
  const { data: lines, isLoading: linesLoading } = useQuery({
    queryKey: ['stock-take', sessionId, 'lines'],
    queryFn: () => getLines(sessionId!),
    enabled: !!sessionId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-take', sessionId] })
    queryClient.invalidateQueries({ queryKey: ['stock-take', sessionId, 'lines'] })
  }

  const save = useMutation({
    mutationFn: ({ lineId, qty }: { lineId: string; qty: number | null }) => saveCountedQty(lineId, qty),
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({ title: 'Could not save count', description: e.message, variant: 'destructive' }),
  })

  const submit = useMutation({
    mutationFn: () => submitSession(sessionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-take'] })
      toast({ title: 'Submitted', description: 'A pharmacist will review the variances.' })
      navigate('/pharmacy/stock-take')
    },
    onError: (e: Error) =>
      toast({ title: 'Could not submit', description: e.message, variant: 'destructive' }),
  })

  if (sessionLoading || linesLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
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

  if (session.status !== 'draft') {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="mb-1 font-display text-lg font-semibold text-ink">
            This count is {session.status}.
          </p>
          <p className="mb-4 text-sm text-muted">Counting is closed. Review the variances instead.</p>
          <Link to={`/pharmacy/stock-take/${session.id}/review`}>
            <Button size="sm">Open review</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  const visible = (lines || []).filter((l) =>
    (l.drug_name || '').toLowerCase().includes(filter.trim().toLowerCase())
  )
  const counted = (lines || []).filter((l) => l.counted_qty !== null).length
  const total = lines?.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="otc" className="tnum">
          {counted} of {total} counted
        </Badge>
        <span className="flex-1" />
        {role === 'pharmacist' && (
          <Link to={`/pharmacy/stock-take/${session.id}/review`}>
            <Button size="sm" variant="outline">
              Review variances
            </Button>
          </Link>
        )}
        <Button size="sm" disabled={submit.isPending || total === 0} onClick={() => submit.mutate()}>
          {submit.isPending ? 'Submitting...' : 'Submit for approval'}
        </Button>
      </div>

      <div className="relative">
        <i
          className="ph ph-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Filter drugs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-full pl-11"
          autoComplete="off"
        />
      </div>

      {visible.map((line) => (
        <div
          key={line.id}
          className="flex items-center gap-3.5 rounded-row bg-card p-3 pr-4 shadow-resting"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-ink">{line.drug_name}</p>
            <p className="tnum text-xs text-muted">
              System {line.system_qty} · {line.drug_strength} {line.drug_form}
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <label htmlFor={`count-${line.id}`} className="label-micro hidden sm:block">
              Counted
            </label>
            <Input
              id={`count-${line.id}`}
              inputMode="numeric"
              placeholder="—"
              defaultValue={line.counted_qty ?? ''}
              key={`${line.id}-${line.counted_qty}`}
              onBlur={(e) => {
                const raw = e.target.value.trim()
                if (raw === '') {
                  if (line.counted_qty !== null) save.mutate({ lineId: line.id, qty: null })
                  return
                }
                const qty = parseInt(raw, 10)
                if (!Number.isInteger(qty) || qty < 0) {
                  toast({ title: 'Check count', description: 'Whole numbers, 0 or more.', variant: 'destructive' })
                  e.target.value = line.counted_qty?.toString() ?? ''
                  return
                }
                if (qty !== line.counted_qty) save.mutate({ lineId: line.id, qty })
              }}
              className="tnum h-11 w-24 text-center"
            />
          </div>
        </div>
      ))}

      {visible.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted">
            Nothing matches this filter.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
