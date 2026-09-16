import { Language } from '../types/language';

interface Translation {
  languageCode: string;
  name: string;
}

export function resolveTranslationName(translations: readonly Translation[], language: Language): string {
  return (
    translations.find((t) => t.languageCode === language)?.name ??
    translations.find((t) => t.languageCode === 'en')?.name ??
    translations[0]?.name ??
    ''
  );
}
