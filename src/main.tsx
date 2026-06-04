import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from '@/app/providers/AppProvider'
import App from '@/app/App'
import { i18nReady } from '@/i18n'
// 모듈 import 만으로 저장된 테마(.dark)를 첫 페인트 전에 적용한다.
import '@/shared/stores/theme.store'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import '@/index.css'

// 초기 언어 locale 리소스가 lazy-load 되므로, 로드 완료 후 렌더해 raw key flash 를 막는다.
void i18nReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})