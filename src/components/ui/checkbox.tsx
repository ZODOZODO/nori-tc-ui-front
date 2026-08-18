import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * 체크박스입니다. tri-state(`checked="indeterminate"`)를 지원해 "일부 선택" 헤더 체크박스가
 * 명령형 `input.indeterminate` 조작 없이 상태만으로 표현됩니다.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-input bg-card',
        'transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary data-[state=checked]:text-white',
        'data-[state=indeterminate]:border-brand-primary data-[state=indeterminate]:bg-brand-primary data-[state=indeterminate]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3" aria-hidden="true" />
        ) : (
          <Check className="size-3" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
