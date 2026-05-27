import { Button } from '@/components/ui/button'
import { useI18n } from './i18n-context'

/**
 * ko ↔ en 언어 전환 토글입니다. 현재 언어를 표시하고 클릭 시 다른 언어로 전환합니다.
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()

  return (
    <Button
      type="button"
      variant="outline"
      className="h-[38px] rounded-full border-[#DCE5E0] px-3.5 text-sm font-medium text-[#4B5A52]"
      onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
      aria-label={t('language.toggleLabel')}
    >
      {lang === 'ko' ? t('language.ko') : t('language.en')}
    </Button>
  )
}
