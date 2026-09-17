import { formatStock } from '@/utils/helpers'
import { cn } from '@/utils/helpers'

export function StockPill({ quantity, className }: { quantity: number; className?: string }) {
  const stock = formatStock(quantity)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-[5px] text-xs font-medium',
        stock.class,
        className
      )}
    >
      {stock.label}
    </span>
  )
}
