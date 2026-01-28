/**
 * Internationalization (i18n) Setup
 *
 * Uses Lingui for translations with automatic language detection.
 * Supports: English (en), Chinese Simplified (zh), Spanish (es)
 */

import { i18n } from '@lingui/core';

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'zh', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Locale display names (in their own language)
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  zh: '中文',
  es: 'Español',
};

// Storage key for persisted locale preference
const LOCALE_STORAGE_KEY = 'thinking-tracer-locale';

// Locale change subscribers
type LocaleChangeCallback = (locale: SupportedLocale) => void;
const localeChangeCallbacks: LocaleChangeCallback[] = [];

/**
 * Detect the user's preferred locale
 * Priority: URL param > localStorage > browser language > default (en)
 */
export function detectLocale(): SupportedLocale {
  // 1. Check URL parameter (?lang=zh)
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang && isValidLocale(urlLang)) {
    return urlLang;
  }

  // 2. Check localStorage for saved preference
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && isValidLocale(saved)) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable
  }

  // 3. Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (isValidLocale(browserLang)) {
    return browserLang;
  }

  // 4. Default to English
  return 'en';
}

/**
 * Check if a locale string is supported
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Save locale preference to localStorage
 */
export function saveLocalePreference(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Load messages for a locale dynamically
 */
async function loadMessages(locale: SupportedLocale): Promise<void> {
  let messages;

  switch (locale) {
    case 'en':
      messages = (await import('./locales/en/messages')).messages;
      break;
    case 'zh':
      messages = (await import('./locales/zh/messages')).messages;
      break;
    case 'es':
      messages = (await import('./locales/es/messages')).messages;
      break;
  }

  i18n.load(locale, messages);
}

/**
 * Initialize i18n with detected or specified locale
 */
export async function initI18n(locale?: SupportedLocale): Promise<SupportedLocale> {
  const targetLocale = locale ?? detectLocale();

  await loadMessages(targetLocale);
  i18n.activate(targetLocale);
  i18nInitialized = true;

  // Update document language attribute
  document.documentElement.lang = targetLocale;

  return targetLocale;
}

/**
 * Change the active locale
 */
export async function changeLocale(locale: SupportedLocale): Promise<void> {
  await loadMessages(locale);
  i18n.activate(locale);
  saveLocalePreference(locale);

  // Update document language attribute
  document.documentElement.lang = locale;

  // Remove lang param from URL if present (clean URL)
  const url = new URL(window.location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    window.history.replaceState({}, '', url.toString());
  }

  // Notify subscribers
  for (const callback of localeChangeCallbacks) {
    callback(locale);
  }
}

/**
 * Get the current active locale
 */
export function getCurrentLocale(): SupportedLocale {
  return (i18n.locale as SupportedLocale) || 'en';
}

// Track if i18n has been initialized
let i18nInitialized = false;

/**
 * Translate a message key with optional interpolation values
 * @param key The message key (e.g., 'landing.dropText')
 * @param values Optional interpolation values (e.g., { count: 5 })
 */
export function t(key: string, values?: Record<string, string | number>): string {
  // If i18n not yet initialized, return key (will be updated when locale changes)
  if (!i18nInitialized) {
    // Simple interpolation fallback for pre-init calls
    if (values) {
      let result = key;
      for (const [k, v] of Object.entries(values)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
      return result;
    }
    return key;
  }

  // Use Lingui's internal translation function
  return i18n._(key, values);
}

/**
 * Subscribe to locale changes
 * @returns Unsubscribe function
 */
export function onLocaleChange(callback: LocaleChangeCallback): () => void {
  localeChangeCallbacks.push(callback);
  return () => {
    const index = localeChangeCallbacks.indexOf(callback);
    if (index > -1) {
      localeChangeCallbacks.splice(index, 1);
    }
  };
}

// Export i18n instance for advanced use cases
export { i18n };
