import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
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

function PanelLogRow({ entry }: { entry: CommLogEntry }) {
  const isRecv = entry.direction === 'RECV'
  return (
    <div className="flex gap-3 border-b border-[#1C2530] px-3 py-1.5 text-[10px]">
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
    </div>
  )
}

function ClickableLogRow({
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
      className="flex w-full cursor-pointer gap-3 border-b border-[#E5ECE7] px-4 py-2 text-left text-[12px] transition hover:bg-[#EAF2EC] focus:bg-[#EAF2EC] focus:outline-none"
    >
      <span className="w-[96px] shrink-0 font-mono text-[#6D7A73]">
        {formatTime(entry.timestampMs)}
      </span>
      <span
        className={[
          'w-[44px] shrink-0 font-bold',
          isRecv ? 'text-[#1B6FB5]' : 'text-[#B5680B]',
        ].join(' ')}
      >
        {entry.direction}
      </span>
      <span className="w-[48px] shrink-0 font-semibold text-[#6D7A73]">
        {entry.source}
      </span>
      <span
        className="w-[220px] shrink-0 truncate font-semibold text-[#22332A]"
        title={entry.messageName ?? undefined}
      >
        {entry.messageName ?? '-'}
      </span>
      <span className="min-w-0 flex-1 truncate text-[#5A6862]">
        {entry.payload ?? ''}
      </span>
    </button>
  )
}

function CommLogListModal({
  eqpId,
  logs,
  open,
  onClose,
  onSelectEntry,
}: {
  eqpId: string
  logs: readonly CommLogEntry[]
  open: boolean
  onClose: () => void
  onSelectEntry: (entry: CommLogEntry) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 flex flex-col gap-0 overflow-hidden border-[#DCE7E0] bg-[#F7FAF8] p-0 text-[#22332A]">
        <DialogHeader className="border-b border-[#E1EAE4] px-5 py-4">
          <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-[#1F2D26]">
            <span>통신 로그</span>
            <span className="font-mono text-[12px] text-[#6D7A73]">{eqpId}</span>
            <span className="rounded-md bg-[#EAF2EC] px-2 py-0.5 text-[11px] font-normal text-[#1C7F59]">
              {logs.length}건
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center py-16 text-[12px] text-[#8D9893]">
              최근 1시간 내 로그가 없습니다.
            </div>
          ) : (
            <div className="flex min-w-max flex-col-reverse">
              {[...logs].reverse().map((entry, idx) => (
                <ClickableLogRow
                  key={`${entry.timestampMs}-${idx}`}
                  entry={entry}
                  onSelect={onSelectEntry}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="flex max-h-[85vh] max-w-[960px] flex-col gap-0 overflow-hidden border-[#DCE7E0] bg-[#F7FAF8] p-0 text-[#22332A]">
        {entry ? (
          <>
            <DialogHeader className="border-b border-[#E1EAE4] px-5 py-4">
              <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-[#1F2D26]">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[11px] font-bold',
                    isRecv
                      ? 'bg-[#DCEBF7] text-[#1B6FB5]'
                      : 'bg-[#FBE8CC] text-[#B5680B]',
                  ].join(' ')}
                >
                  {entry.direction}
                </span>
                <span className="text-[#6D7A73]">{entry.source}</span>
                <span className="truncate">{entry.messageName ?? '-'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[#E1EAE4] px-5 py-3 text-[11px] text-[#6D7A73]">
              <span>
                <span className="text-[#8D9893]">eqpId </span>
                <span className="font-mono text-[#22332A]">{entry.eqpId}</span>
              </span>
              <span>
                <span className="text-[#8D9893]">time </span>
                <span className="font-mono text-[#22332A]">
                  {formatTime(entry.timestampMs)}
                </span>
              </span>
              <span>
                <span className="text-[#8D9893]">epoch </span>
                <span className="font-mono text-[#22332A]">
                  {entry.timestampMs}
                </span>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-[#1F2D26]">
                {formatPayload(entry.payload) || (
                  <span className="text-[#8D9893]">(payload 없음)</span>
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
  const [isListOpen, setIsListOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CommLogEntry | null>(null)

  return (
    <>
      <div className="mt-3 flex h-full min-h-0 flex-col rounded-[12px] border border-[#212A32] bg-[#151B20]">
        <button
          type="button"
          onClick={() => setIsListOpen(true)}
          className="flex w-full cursor-pointer items-center justify-between border-b border-[#212A32] px-3 py-2 text-left transition hover:bg-[#1C2530] focus:bg-[#1C2530] focus:outline-none"
          aria-label="통신 로그 전체 보기"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">통신 로그</span>
            <Maximize2 className="size-3 text-[#7E8892]" aria-hidden="true" />
          </div>
          {isFetching && (
            <span className="text-[9px] text-[#4B5A6A]">갱신 중...</span>
          )}
        </button>

        <div className="flex-1 min-h-0 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[10px] text-[#4B5A6A]">
              최근 1시간 내 로그가 없습니다.
            </div>
          ) : (
            <div className="flex min-w-max flex-col-reverse">
              {[...logs].reverse().map((entry, idx) => (
                <PanelLogRow
                  key={`${entry.timestampMs}-${idx}`}
                  entry={entry}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CommLogListModal
        eqpId={eqpId}
        logs={logs}
        open={isListOpen}
        onClose={() => setIsListOpen(false)}
        onSelectEntry={setSelectedEntry}
      />

      <CommLogDetailModal
        entry={selectedEntry}
        open={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
      />
    </>
  )
}
