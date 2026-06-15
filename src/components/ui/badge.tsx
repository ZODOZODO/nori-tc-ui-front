import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-success/15 text-success',
        secondary: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border bg-background text-foreground',
        info: 'border-transparent bg-info/15 text-info',
        develop: 'border-transparent bg-develop/15 text-develop',
        warning: 'border-transparent bg-warning/15 text-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
