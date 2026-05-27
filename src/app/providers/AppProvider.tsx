import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { I18nProvider } from '@/i18n/I18nProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
      retry: 1,                  // 실패 시 1회 재시도
      // 창 포커스 전환 시 자동 refetch 비활성화
      // staleTime=0 쿼리가 많아 포커스마다 401이 발생하면 /login 리다이렉트로 선택 상태가 초기화됨
      refetchOnWindowFocus: false,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'nori-tc-ui-cache',
})

// 보안 민감 / polling / 동적 filter 의존 query 는 dehydrate 제외.
// - auth: 로그인 사용자 권한 코드 — 권한 변경 즉시 반영을 위해 매번 fresh.
// - user / group: 다른 사용자/그룹 정보 — 공유 PC 에서 localStorage 노출 차단.
// - live-map: 5s polling — 재방문 즉시 refetch 되므로 persist 무의미.
// - deploy: 전부 동적 filter (history) / polling (targets/summary) 라 cache hit 가능성 낮음.
const PERSIST_DENY_QUERY_HEADS = new Set(['auth', 'user', 'group', 'live-map', 'deploy'])

const shouldDehydrateQuery = (query: Query): boolean => {
  if (!defaultShouldDehydrateQuery(query)) {
    return false
  }
  const head = query.queryKey[0]
  if (typeof head !== 'string') {
    return false
  }
  return !PERSIST_DENY_QUERY_HEADS.has(head)
}

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 30 * 60 * 1000,
        dehydrateOptions: { shouldDehydrateQuery },
      }}
    >
      <I18nProvider>{children}</I18nProvider>
      {/* 개발 환경에서만 쿼리 상태 확인 패널 표시 */}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  )
}
