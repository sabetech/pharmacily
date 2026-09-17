import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/helpers'

// Status pills: a pill states a fact. Rose is reserved for expiry and refunds.
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-[5px] text-xs font-medium transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default: 'bg-deep text-[#f4faf1]',
        secondary: 'bg-ground text-muted',
        outline: 'border border-[rgba(16,50,40,0.16)] text-deep',
        instock: 'bg-stock-bg text-stock-ink',
        lowstock: 'bg-sales-bg text-sales-ink',
        expiry: 'bg-expiry-bg text-expiry-ink',
        rx: 'bg-people-bg text-people-ink',
        otc: 'bg-ground text-muted',
        // legacy aliases kept for existing call sites
        success: 'bg-stock-bg text-stock-ink',
        warning: 'bg-sales-bg text-sales-ink',
        info: 'bg-people-bg text-people-ink',
        destructive: 'bg-expiry-bg text-expiry-ink',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
