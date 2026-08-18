import * as React from 'react'
import { cn } from '@/lib/utils'
import { controlBaseClassName } from './control-styles'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        controlBaseClassName,
        'h-10 px-3',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
