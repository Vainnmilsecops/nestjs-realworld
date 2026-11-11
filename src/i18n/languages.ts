export const ENGLISH = 'en';
export const VIETNAMESE = 'vi';
export const SUPPORTED_LANGUAGES = [ENGLISH, VIETNAMESE] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
