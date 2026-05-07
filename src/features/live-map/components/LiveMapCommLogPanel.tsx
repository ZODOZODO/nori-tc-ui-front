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

function LogRow({ entry }: { entry: CommLogEntry }) {
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

export function LiveMapCommLogPanel({ eqpId }: LiveMapCommLogPanelProps) {
  const { data: logs = [], isFetching } = useCommLog(eqpId, 'all')

  return (
    <div className="mt-3 flex h-full flex-col rounded-[12px] border border-[#212A32] bg-[#151B20]">
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
              <LogRow key={`${entry.timestampMs}-${idx}`} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
