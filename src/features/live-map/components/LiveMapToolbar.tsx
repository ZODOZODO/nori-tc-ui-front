import { Radar, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-[#E5ECE7] bg-[#FCFDFC] p-3 shadow-[0_8px_18px_rgba(32,50,38,0.05)] lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7A8A81]" />
        <Input
          value={searchKeyword}
          onChange={(event) => onSearchKeywordChange(event.target.value)}
          placeholder="설비명 / Eqp ID / 라인 검색"
          className="h-[42px] rounded-[14px] border-[#E2E9E4] bg-white pl-11 text-sm text-[#405046] placeholder:text-[#96A19B]"
        />
      </div>

      <Select value={selectedLine} onValueChange={onSelectedLineChange}>
        <SelectTrigger className="h-[38px] w-full rounded-[14px] border-[#E2E9E4] px-3 text-sm text-[#405046] lg:w-[150px]">
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
        <SelectTrigger className="h-[38px] w-full rounded-[14px] border-[#E2E9E4] px-3 text-sm text-[#405046] lg:w-[150px]">
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

      <div className="inline-flex h-[38px] items-center justify-center gap-2 self-start rounded-[14px] bg-[#16211C] px-4 text-[11px] font-bold tracking-[0.08em] text-[#F7FBF8] lg:self-auto">
        <Radar className="size-3.5 text-[#C8F1D4]" />
        Map Live
      </div>
    </section>
  )
}
