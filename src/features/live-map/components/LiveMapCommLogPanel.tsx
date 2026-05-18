import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CommLogEntry } from '../api/comm-log.api'
import { useCommLog } from '../hooks/useCommLog'

interface LiveMapCommLogPanelProps {
  eqpId: string
}

function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function formatPayload(raw: string | null): string {
  if (raw === null || raw === '') {
    return ''
  }
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function LogRow({
  entry,
  onSelect,
}: {
  entry: CommLogEntry
  onSelect: (entry: CommLogEntry) => void
}) {
  const isRecv = entry.direction === 'RECV'
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="flex w-full cursor-pointer gap-3 border-b border-[#1C2530] px-3 py-1.5 text-left text-[10px] transition hover:bg-[#1C2530] focus:bg-[#1C2530] focus:outline-none"
    >
      <span className="w-[72px] shrink-0 font-mono text-[#6B7A8A]">
        {formatTime(entry.timestampMs)}
      </span>
      <span
        className={[
          'w-[34px] shrink-0 font-bold',
          isRecv ? 'text-[#4EA6FF]' : 'text-[#F5A623]',
        ].join(' ')}
      >
        {entry.direction}
      </span>
      <span className="w-[36px] shrink-0 font-semibold text-[#7E8892]">
        {entry.source}
      </span>
      <span
        className="w-[180px] shrink-0 truncate font-semibold text-[#C9D3DB]"
        title={entry.messageName ?? undefined}
      >
        {entry.messageName ?? '-'}
      </span>
      <span className="min-w-0 flex-1 break-all text-[#6B7A8A]">
        {entry.payload ?? ''}
      </span>
    </button>
  )
}

function CommLogDetailModal({
  entry,
  open,
  onClose,
}: {
  entry: CommLogEntry | null
  open: boolean
  onClose: () => void
}) {
  const isRecv = entry?.direction === 'RECV'
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-[960px] flex-col gap-0 overflow-hidden border-[#1C2530] bg-[#0E1418] p-0 text-[#C9D3DB]">
        {entry ? (
          <>
            <DialogHeader className="border-b border-[#1C2530] px-5 py-4">
              <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-[#E2EAF0]">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[11px] font-bold',
                    isRecv
                      ? 'bg-[#13314D] text-[#4EA6FF]'
                      : 'bg-[#3A2A10] text-[#F5A623]',
                  ].join(' ')}
                >
                  {entry.direction}
                </span>
                <span className="text-[#7E8892]">{entry.source}</span>
                <span className="truncate">{entry.messageName ?? '-'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[#1C2530] px-5 py-3 text-[11px] text-[#7E8892]">
              <span>
                <span className="text-[#4B5A6A]">eqpId </span>
                <span className="font-mono text-[#C9D3DB]">{entry.eqpId}</span>
              </span>
              <span>
                <span className="text-[#4B5A6A]">time </span>
                <span className="font-mono text-[#C9D3DB]">
                  {formatTime(entry.timestampMs)}
                </span>
              </span>
              <span>
                <span className="text-[#4B5A6A]">epoch </span>
                <span className="font-mono text-[#C9D3DB]">
                  {entry.timestampMs}
                </span>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-[#D8E1E8]">
                {formatPayload(entry.payload) || (
                  <span className="text-[#4B5A6A]">(payload 없음)</span>
                )}
              </pre>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function LiveMapCommLogPanel({ eqpId }: LiveMapCommLogPanelProps) {
  const { data: logs = [], isFetching } = useCommLog(eqpId, 'all')
  const [selectedEntry, setSelectedEntry] = useState<CommLogEntry | null>(null)

  return (
    <>
      <div className="mt-3 flex h-full min-h-0 flex-col rounded-[12px] border border-[#212A32] bg-[#151B20]">
        <div className="flex items-center justify-between border-b border-[#212A32] px-3 py-2">
          <div className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">통신 로그</div>
          {isFetching && (
            <span className="text-[9px] text-[#4B5A6A]">갱신 중...</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[10px] text-[#4B5A6A]">
              최근 1시간 내 로그가 없습니다.
            </div>
          ) : (
            <div className="flex min-w-max flex-col-reverse">
              {[...logs].reverse().map((entry, idx) => (
                <LogRow
                  key={`${entry.timestampMs}-${idx}`}
                  entry={entry}
                  onSelect={setSelectedEntry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CommLogDetailModal
        entry={selectedEntry}
        open={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  )
}
