import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import type { LiveMapLineOption, LiveMapStatusFilter } from '../types/live-map.types'

interface LiveMapToolbarProps {
  searchKeyword: string
  selectedLine: string
  selectedStatus: LiveMapStatusFilter
  lineOptions: readonly LiveMapLineOption[]
  stateOptions: readonly { value: LiveMapStatusFilter; label: string }[]
  onSearchKeywordChange: (searchKeyword: string) => void
  onSelectedLineChange: (selectedLine: string) => void
  onSelectedStatusChange: (selectedStatus: LiveMapStatusFilter) => void
}

export function LiveMapToolbar({
  searchKeyword,
  selectedLine,
  selectedStatus,
  lineOptions,
  stateOptions,
  onSearchKeywordChange,
  onSelectedLineChange,
  onSelectedStatusChange,
}: LiveMapToolbarProps) {
  const { t } = useI18n()

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-border bg-card p-3 shadow-soft-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchKeyword}
          onChange={(event) => onSearchKeywordChange(event.target.value)}
          placeholder={t('livemap.search.placeholder')}
          className="h-[42px] rounded-[14px] pl-11 text-sm"
        />
      </div>

      <Select value={selectedLine} onValueChange={onSelectedLineChange}>
        <SelectTrigger className="h-[38px] w-full rounded-[14px] px-3 text-sm lg:w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {lineOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedStatus} onValueChange={(value) => onSelectedStatusChange(value as LiveMapStatusFilter)}>
        <SelectTrigger className="h-[38px] w-full rounded-[14px] px-3 text-sm lg:w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stateOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  )
}
