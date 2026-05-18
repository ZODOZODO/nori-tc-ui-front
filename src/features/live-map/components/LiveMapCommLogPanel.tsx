import { useState } from 'react'
import { Maximize2, Moon, Sun } from 'lucide-react'
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

type CommLogTheme = 'light' | 'dark'

const COMM_LOG_THEME_STORAGE_KEY = 'live-map.comm-log-theme'

interface CommLogThemeTokens {
  containerBg: string
  containerBorder: string
  headerBorder: string
  titleText: string
  metaText: string
  mutedText: string
  bodyText: string
  rowBorder: string
  rowHover: string
  countBadgeBg: string
  countBadgeText: string
  recvText: string
  sendText: string
  recvBadgeBg: string
  recvBadgeText: string
  sendBadgeBg: string
  sendBadgeText: string
  payloadText: string
  emptyText: string
  toggleHoverBg: string
}

const LIGHT_THEME: CommLogThemeTokens = {
  containerBg: 'bg-[#F7FAF8]',
  containerBorder: 'border-[#DCE7E0]',
  headerBorder: 'border-[#E1EAE4]',
  titleText: 'text-[#1F2D26]',
  metaText: 'text-[#6D7A73]',
  mutedText: 'text-[#8D9893]',
  bodyText: 'text-[#22332A]',
  rowBorder: 'border-[#E5ECE7]',
  rowHover: 'hover:bg-[#EAF2EC] focus:bg-[#EAF2EC]',
  countBadgeBg: 'bg-[#EAF2EC]',
  countBadgeText: 'text-[#1C7F59]',
  recvText: 'text-[#1B6FB5]',
  sendText: 'text-[#B5680B]',
  recvBadgeBg: 'bg-[#DCEBF7]',
  recvBadgeText: 'text-[#1B6FB5]',
  sendBadgeBg: 'bg-[#FBE8CC]',
  sendBadgeText: 'text-[#B5680B]',
  payloadText: 'text-[#1F2D26]',
  emptyText: 'text-[#8D9893]',
  toggleHoverBg: 'hover:bg-[#EAF2EC]',
}

const DARK_THEME: CommLogThemeTokens = {
  containerBg: 'bg-[#0E1418]',
  containerBorder: 'border-[#1C2530]',
  headerBorder: 'border-[#1C2530]',
  titleText: 'text-[#E2EAF0]',
  metaText: 'text-[#7E8892]',
  mutedText: 'text-[#4B5A6A]',
  bodyText: 'text-[#C9D3DB]',
  rowBorder: 'border-[#1C2530]',
  rowHover: 'hover:bg-[#1C2530] focus:bg-[#1C2530]',
  countBadgeBg: 'bg-[#1C2530]',
  countBadgeText: 'text-[#7E8892]',
  recvText: 'text-[#4EA6FF]',
  sendText: 'text-[#F5A623]',
  recvBadgeBg: 'bg-[#13314D]',
  recvBadgeText: 'text-[#4EA6FF]',
  sendBadgeBg: 'bg-[#3A2A10]',
  sendBadgeText: 'text-[#F5A623]',
  payloadText: 'text-[#D8E1E8]',
  emptyText: 'text-[#4B5A6A]',
  toggleHoverBg: 'hover:bg-[#1C2530]',
}

function resolveTheme(theme: CommLogTheme): CommLogThemeTokens {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME
}

function readInitialCommLogTheme(): CommLogTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const stored = window.localStorage.getItem(COMM_LOG_THEME_STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

function persistCommLogTheme(theme: CommLogTheme): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(COMM_LOG_THEME_STORAGE_KEY, theme)
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
  tokens,
  onSelect,
}: {
  entry: CommLogEntry
  tokens: CommLogThemeTokens
  onSelect: (entry: CommLogEntry) => void
}) {
  const isRecv = entry.direction === 'RECV'
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={[
        'flex w-full cursor-pointer gap-3 border-b px-4 py-2 text-left text-[12px] transition focus:outline-none',
        tokens.rowBorder,
        tokens.rowHover,
      ].join(' ')}
    >
      <span className={['w-[96px] shrink-0 font-mono', tokens.metaText].join(' ')}>
        {formatTime(entry.timestampMs)}
      </span>
      <span
        className={[
          'w-[44px] shrink-0 font-bold',
          isRecv ? tokens.recvText : tokens.sendText,
        ].join(' ')}
      >
        {entry.direction}
      </span>
      <span
        className={['w-[48px] shrink-0 font-semibold', tokens.metaText].join(' ')}
      >
        {entry.source}
      </span>
      <span
        className={[
          'w-[220px] shrink-0 truncate font-semibold',
          tokens.bodyText,
        ].join(' ')}
        title={entry.messageName ?? undefined}
      >
        {entry.messageName ?? '-'}
      </span>
      <span className={['min-w-0 flex-1 truncate', tokens.metaText].join(' ')}>
        {entry.payload ?? ''}
      </span>
    </button>
  )
}

function ThemeToggleButton({
  theme,
  tokens,
  onToggle,
}: {
  theme: CommLogTheme
  tokens: CommLogThemeTokens
  onToggle: () => void
}) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'ml-auto mr-8 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition focus:outline-none',
        tokens.containerBorder,
        tokens.metaText,
        tokens.toggleHoverBg,
      ].join(' ')}
      aria-label={isDark ? '밝게 보기' : '어둡게 보기'}
      title={isDark ? '밝게 보기' : '어둡게 보기'}
    >
      {isDark ? (
        <Sun className="size-3.5" aria-hidden="true" />
      ) : (
        <Moon className="size-3.5" aria-hidden="true" />
      )}
      <span>{isDark ? '밝게' : '어둡게'}</span>
    </button>
  )
}

function CommLogListModal({
  eqpId,
  logs,
  open,
  theme,
  onClose,
  onToggleTheme,
  onSelectEntry,
}: {
  eqpId: string
  logs: readonly CommLogEntry[]
  open: boolean
  theme: CommLogTheme
  onClose: () => void
  onToggleTheme: () => void
  onSelectEntry: (entry: CommLogEntry) => void
}) {
  const tokens = resolveTheme(theme)
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={[
          '!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 flex flex-col gap-0 overflow-hidden p-0',
          tokens.containerBg,
          tokens.containerBorder,
          tokens.bodyText,
        ].join(' ')}
      >
        <DialogHeader className={['border-b px-5 py-4', tokens.headerBorder].join(' ')}>
          <DialogTitle
            className={[
              'flex items-center gap-3 text-sm font-semibold',
              tokens.titleText,
            ].join(' ')}
          >
            <span>통신 로그</span>
            <span className={['font-mono text-[12px]', tokens.metaText].join(' ')}>
              {eqpId}
            </span>
            <span
              className={[
                'rounded-md px-2 py-0.5 text-[11px] font-normal',
                tokens.countBadgeBg,
                tokens.countBadgeText,
              ].join(' ')}
            >
              {logs.length}건
            </span>
            <ThemeToggleButton theme={theme} tokens={tokens} onToggle={onToggleTheme} />
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {logs.length === 0 ? (
            <div
              className={[
                'flex h-full items-center justify-center py-16 text-[12px]',
                tokens.emptyText,
              ].join(' ')}
            >
              최근 1시간 내 로그가 없습니다.
            </div>
          ) : (
            <div className="flex min-w-max flex-col-reverse">
              {[...logs].reverse().map((entry, idx) => (
                <ClickableLogRow
                  key={`${entry.timestampMs}-${idx}`}
                  entry={entry}
                  tokens={tokens}
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
  theme,
  onClose,
  onToggleTheme,
}: {
  entry: CommLogEntry | null
  open: boolean
  theme: CommLogTheme
  onClose: () => void
  onToggleTheme: () => void
}) {
  const tokens = resolveTheme(theme)
  const isRecv = entry?.direction === 'RECV'
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={[
          'flex max-h-[85vh] max-w-[960px] flex-col gap-0 overflow-hidden p-0',
          tokens.containerBg,
          tokens.containerBorder,
          tokens.bodyText,
        ].join(' ')}
      >
        {entry ? (
          <>
            <DialogHeader
              className={['border-b px-5 py-4', tokens.headerBorder].join(' ')}
            >
              <DialogTitle
                className={[
                  'flex items-center gap-3 text-sm font-semibold',
                  tokens.titleText,
                ].join(' ')}
              >
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[11px] font-bold',
                    isRecv ? tokens.recvBadgeBg : tokens.sendBadgeBg,
                    isRecv ? tokens.recvBadgeText : tokens.sendBadgeText,
                  ].join(' ')}
                >
                  {entry.direction}
                </span>
                <span className={tokens.metaText}>{entry.source}</span>
                <span className="truncate">{entry.messageName ?? '-'}</span>
                <ThemeToggleButton
                  theme={theme}
                  tokens={tokens}
                  onToggle={onToggleTheme}
                />
              </DialogTitle>
            </DialogHeader>

            <div
              className={[
                'flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-3 text-[11px]',
                tokens.headerBorder,
                tokens.metaText,
              ].join(' ')}
            >
              <span>
                <span className={tokens.mutedText}>eqpId </span>
                <span className={['font-mono', tokens.bodyText].join(' ')}>
                  {entry.eqpId}
                </span>
              </span>
              <span>
                <span className={tokens.mutedText}>time </span>
                <span className={['font-mono', tokens.bodyText].join(' ')}>
                  {formatTime(entry.timestampMs)}
                </span>
              </span>
              <span>
                <span className={tokens.mutedText}>epoch </span>
                <span className={['font-mono', tokens.bodyText].join(' ')}>
                  {entry.timestampMs}
                </span>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              <pre
                className={[
                  'whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed',
                  tokens.payloadText,
                ].join(' ')}
              >
                {formatPayload(entry.payload) || (
                  <span className={tokens.mutedText}>(payload 없음)</span>
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
  const [modalTheme, setModalTheme] = useState<CommLogTheme>(readInitialCommLogTheme)

  const toggleModalTheme = () => {
    setModalTheme((prev) => {
      const next: CommLogTheme = prev === 'light' ? 'dark' : 'light'
      persistCommLogTheme(next)
      return next
    })
  }

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
        theme={modalTheme}
        onClose={() => setIsListOpen(false)}
        onToggleTheme={toggleModalTheme}
        onSelectEntry={setSelectedEntry}
      />

      <CommLogDetailModal
        entry={selectedEntry}
        open={selectedEntry !== null}
        theme={modalTheme}
        onClose={() => setSelectedEntry(null)}
        onToggleTheme={toggleModalTheme}
      />
    </>
  )
}
