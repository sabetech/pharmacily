import * as React from 'react'
import { cn } from '@/utils/helpers'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// Fields sit on a barely-tinted fill, not white. Focus is a 1px live-green edge.
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3.5 py-2 text-[15px] text-ink file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus:border-live focus:outline-none focus:ring-[3px] focus:ring-[rgba(29,122,95,0.12)] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
