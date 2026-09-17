import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'

export function Suppliers() {
  const { toast } = useToast()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="tnum text-sm text-muted">Purchasing lives here.</p>
        <span className="flex-1" />
        <Button
          size="sm"
          onClick={() =>
            toast({ title: 'Coming soon', description: 'Supplier records arrive with purchasing.' })
          }
        >
          <i className="ph ph-plus mr-1" aria-hidden="true" /> Add supplier
        </Button>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-stock-bg text-stock-label">
            <i className="ph ph-truck text-[22px]" aria-hidden="true" />
          </span>
          <h3 className="mb-2 font-display text-lg font-semibold text-ink">No suppliers yet</h3>
          <p className="mx-auto max-w-md text-sm text-muted">
            Supplier balances, deliveries, and purchase orders arrive with purchasing. Nothing to pay
            down in the meantime.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
