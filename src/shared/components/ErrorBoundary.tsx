import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '@/i18n'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 경계 위치 식별자 — 어느 계층이 잡았는지 로그로 구분한다. */
  scope: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 렌더 중 throw 와 `lazy()` 청크 로드 실패를 잡아 복구 UI 를 띄운다.
 *
 * `Suspense` 는 로딩만 처리하고 reject 는 통과시키므로, 경계가 없으면 배포 직후 stale index.html 을
 * 캐싱한 탭에서 청크 404 가 트리 전체를 언마운트해 복구 안내조차 없는 백지가 된다(S09 D-3).
 * 이 앱은 데이터 라우터가 아니라 `<BrowserRouter>+<Routes>` 조합이라 `errorElement` 를 쓸 수 없다.
 *
 * 문구는 React context 가 아니라 i18next 인스턴스에서 직접 읽는다 — 루트 경계는 I18nProvider 보다
 * 위에 있어야 provider 자체의 throw 도 잡을 수 있기 때문이다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.scope}]`, error.message, errorInfo.componentStack)
  }

  render() {
    const { error } = this.state
    if (error === null) {
      return this.props.children
    }

    return (
      <div
        className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-[18px] border border-danger/30 bg-danger/5 px-6 py-10 text-center"
        role="alert"
        data-testid={`error-boundary-${this.props.scope}`}
      >
        <p className="text-sm font-semibold text-danger">{i18n.t('common.error.boundaryTitle')}</p>
        <p className="text-xs text-muted-foreground">{i18n.t('common.error.boundaryHint')}</p>
        <button
          type="button"
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground"
          onClick={() => window.location.reload()}
        >
          {i18n.t('common.error.boundaryReload')}
        </button>
      </div>
    )
  }
}
