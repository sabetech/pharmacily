import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/helpers'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-live focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        // One deep-green primary per view
        default: 'bg-deep text-[#f4faf1] hover:bg-live hover:-translate-y-px hover:shadow-floating',
        destructive: 'bg-expiry-bg text-expiry-ink hover:brightness-95',
        // Secondary: white with a hairline
        outline: 'bg-card text-deep border border-[rgba(16,50,40,0.16)] hover:border-live hover:text-live',
        secondary: 'bg-stock-bg text-stock-ink hover:brightness-95',
        // Tertiary: green text only
        ghost: 'text-live hover:bg-field',
        link: 'text-live underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-10 px-4',
        lg: 'h-11 px-8',
        xl: 'h-12 px-10',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
