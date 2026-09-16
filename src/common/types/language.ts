export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ru'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
