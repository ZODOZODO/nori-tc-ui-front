import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageActionBar } from '@/shared/layout/PageActionBar'
import { PageHeading } from '@/shared/layout/PageHeading'
import { PageHeadingWithActions } from '@/shared/layout/PageHeadingWithActions'
import { PageLayoutShell } from '@/shared/layout/PageLayoutShell'
import { PageLocation } from '@/shared/layout/PageLocation'
import { PageModal } from '@/shared/layout/PageModal'

/**
 * R8 (공통 layout shell pattern) 시각 확인 전용 fixture — 6 variant scene.
 *
 * SPEC R8 L268: bread만 / heading만 / heading+actions / single-card / multi-section / modal.
 * Router 에서 `import.meta.env.DEV` 가드로만 등록되어 production 번들에는 미포함
 * (SelectableTableFixture 선례 답습). 사용자 시각 confirm 게이트의 진입점.
 *
 * 경로: /__fixtures/layout-shell (DEV 전용)
 */
function Scene({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-soft-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </section>
  )
}

export function LayoutShellFixture() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 bg-muted p-6" data-testid="layout-shell-fixture">
      {/* 1. bread만 */}
      <Scene label="1. bread만 (PageLocation)">
        <PageLocation subtitle="설비 관리" name="설비 목록" />
      </Scene>

      {/* 2. heading만 */}
      <Scene label="2. heading만 (PageHeading)">
        <PageHeading
          icon={<Boxes />}
          name="설비 목록"
          description="등록된 설비를 조회하고 관리합니다."
        />
      </Scene>

      {/* 3. heading+actions */}
      <Scene label="3. heading+actions (PageHeadingWithActions + PageActionBar)">
        <PageHeadingWithActions
          icon={<Boxes />}
          name="설비 목록"
          description="등록된 설비를 조회하고 관리합니다."
          actions={
            <PageActionBar>
              <Button variant="outline" size="sm">
                엑셀
              </Button>
              <Button size="sm">등록</Button>
            </PageActionBar>
          }
        />
      </Scene>

      {/* 4. single-card */}
      <Scene label="4. single-card (PageLayoutShell variant=single-card)">
        <PageLayoutShell
          variant="single-card"
          bread={{ name: '로그인' }}
          heading={{ name: '로그인', description: '계정 정보를 입력하세요.' }}
        >
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft-md">
            <p className="text-sm leading-body text-muted-foreground">
              중앙 정렬 단일 카드 콘텐츠 영역 (LoginPage Phase 2 용).
            </p>
          </div>
        </PageLayoutShell>
      </Scene>

      {/* 5. multi-section */}
      <Scene label="5. multi-section (PageLayoutShell variant=multi-section)">
        <PageLayoutShell
          variant="multi-section"
          bread={{ subtitle: '설비 관리', name: '설비 목록' }}
          heading={{ icon: <Boxes />, name: '설비 목록' }}
          actions={
            <PageActionBar>
              <Button size="sm">등록</Button>
            </PageActionBar>
          }
        >
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft-sm">
            섹션 A (표 / 패널)
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-soft-sm">
            섹션 B (표 / 패널)
          </div>
        </PageLayoutShell>
      </Scene>

      {/* 6. modal */}
      <Scene label="6. modal (PageModal)">
        <Button onClick={() => setModalOpen(true)}>모달 열기</Button>
        <PageModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="설비 등록"
          description="새 설비 정보를 입력합니다."
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                취소
              </Button>
              <Button onClick={() => setModalOpen(false)}>저장</Button>
            </>
          }
        >
          <p className="text-muted-foreground">모달 본문 영역 (폼 / 표).</p>
        </PageModal>
      </Scene>
    </div>
  )
}
