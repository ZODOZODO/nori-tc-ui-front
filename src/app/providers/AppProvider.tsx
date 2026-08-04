import { defaultShouldDehydrateQuery, QueryClient, type Query } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { I18nProvider } from '@/i18n/I18nProvider'
import { isPersistableQueryHead, QUERY_CACHE_STORAGE_KEY } from '@/shared/lib/query-persistence'

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
  key: QUERY_CACHE_STORAGE_KEY,
})

// 영속 대상은 allow-list 다(`PERSISTED_QUERY_HEADS`) — 목록에 없는 head 는 전부 제외.
// 종전 deny-list 는 기본값이 "영속" 이라 eqp/model/dlq 업무 데이터가 localStorage 에 남았다(S09 E-1).
const shouldDehydrateQuery = (query: Query): boolean => {
  if (!defaultShouldDehydrateQuery(query)) {
    return false
  }
  return isPersistableQueryHead(query.queryKey[0])
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
