import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import type { CommLogEntry } from '../api/comm-log.api'
import { useCommLog } from '../hooks/useCommLog'

interface LiveMapCommLogPanelProps {
  eqpId: string
}

// 통신 방향 semantic 색 — RECV(수신)=sky, SEND(송신)=warning. 전역 토큰계에 blue 부재로
// RECV 는 sky 팔레트 유지(IDLE 과 동일 보존 규칙), SEND 는 warning 토큰.
const directionTextClass = (isRecv: boolean): string =>
  isRecv ? 'text-sky-600 dark:text-sky-400' : 'text-warning'

const directionDotClass = (isRecv: boolean): string =>
  isRecv ? 'bg-sky-500' : 'bg-warning'

const directionBadgeClass = (isRecv: boolean): string =>
  isRecv ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-warning/15 text-warning'

function formatClock(timestampMs: number): string {
  const d = new Date(timestampMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
      className="flex w-full cursor-pointer gap-3 border-b border-border px-4 py-2 text-left text-[12px] transition hover:bg-muted focus:bg-muted focus:outline-none"
    >
      <span className="w-[96px] shrink-0 font-mono text-muted-foreground">
        {formatTime(entry.timestampMs)}
      </span>
      <span className={['w-[44px] shrink-0 font-bold', directionTextClass(isRecv)].join(' ')}>
        {entry.direction}
      </span>
      <span className="w-[48px] shrink-0 font-semibold text-muted-foreground">{entry.source}</span>
      <span
        className="w-[220px] shrink-0 truncate font-semibold text-foreground"
        title={entry.messageName ?? undefined}
      >
        {entry.messageName ?? '-'}
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.payload ?? ''}</span>
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
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 flex flex-col gap-0 overflow-hidden bg-card p-0 text-foreground">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-foreground">
            <span>{t('livemap.commlog.title')}</span>
            <span className="font-mono text-[12px] text-muted-foreground">{eqpId}</span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
              {logs.length}
              {t('livemap.commlog.countUnit')}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center py-16 text-[12px] text-muted-foreground">
              {t('livemap.commlog.empty')}
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
  const { t } = useI18n()
  const isRecv = entry?.direction === 'RECV'
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-[960px] flex-col gap-0 overflow-hidden bg-card p-0 text-foreground">
        {entry ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-4">
              <DialogTitle className="flex items-center gap-3 text-sm font-semibold text-foreground">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[11px] font-bold',
                    directionBadgeClass(isRecv),
                  ].join(' ')}
                >
                  {entry.direction}
                </span>
                <span className="text-muted-foreground">{entry.source}</span>
                <span className="truncate">{entry.messageName ?? '-'}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border px-5 py-3 text-[11px] text-muted-foreground">
              <span>
                <span className="text-muted-foreground/70">eqpId </span>
                <span className="font-mono text-foreground">{entry.eqpId}</span>
              </span>
              <span>
                <span className="text-muted-foreground/70">time </span>
                <span className="font-mono text-foreground">{formatTime(entry.timestampMs)}</span>
              </span>
              <span>
                <span className="text-muted-foreground/70">epoch </span>
                <span className="font-mono text-foreground">{entry.timestampMs}</span>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <pre className="whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-foreground">
                {formatPayload(entry.payload) || (
                  <span className="text-muted-foreground/70">{t('livemap.commlog.payloadEmpty')}</span>
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
  const { t } = useI18n()
  const { data: logs = [], isFetching } = useCommLog(eqpId, 'all')
  const [isListOpen, setIsListOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<CommLogEntry | null>(null)

  const recentLogs = [...logs].reverse()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
            {t('livemap.commlog.recent')}
          </span>
          {isFetching && (
            <span className="text-[9px] text-muted-foreground">{t('livemap.commlog.syncing')}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsListOpen(true)}
          className="text-[10px] font-semibold text-brand-primary transition-colors hover:text-brand-primary/80"
        >
          {t('livemap.commlog.more')}
        </button>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-[12px] border border-border bg-muted/40 p-1.5">
        {recentLogs.length === 0 ? (
          <div className="flex h-full min-h-[80px] items-center justify-center text-[10px] text-muted-foreground">
            {t('livemap.commlog.empty')}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {recentLogs.map((entry, idx) => {
              const isRecv = entry.direction === 'RECV'
              return (
                <li key={`${entry.timestampMs}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted focus:bg-muted focus:outline-none"
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${directionDotClass(isRecv)}`} />
                    <span className="w-[40px] shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatClock(entry.timestampMs)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                      {entry.messageName ?? entry.payload ?? '-'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
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
    </div>
  )
}
