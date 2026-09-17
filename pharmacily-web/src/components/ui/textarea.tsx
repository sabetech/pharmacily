import * as React from 'react'
import { cn } from '@/utils/helpers'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3.5 py-2 text-[15px] text-ink placeholder:text-muted focus:border-live focus:outline-none focus:ring-[3px] focus:ring-[rgba(29,122,95,0.12)] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }