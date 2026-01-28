/**
 * Test setup file - runs before all tests
 */

import { vi } from 'vitest';

// Mock i18n module - return keys as-is for testing
vi.mock('./i18n', () => ({
  t: (key: string, values?: Record<string, string | number>) => {
    if (values) {
      let result = key;
      for (const [k, v] of Object.entries(values)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
      return result;
    }
    return key;
  },
  initI18n: vi.fn().mockResolvedValue('en'),
  changeLocale: vi.fn().mockResolvedValue(undefined),
  getCurrentLocale: vi.fn().mockReturnValue('en'),
  onLocaleChange: vi.fn().mockReturnValue(() => {}),
  detectLocale: vi.fn().mockReturnValue('en'),
  isValidLocale: vi.fn().mockReturnValue(true),
  saveLocalePreference: vi.fn(),
  SUPPORTED_LOCALES: ['en', 'zh', 'es'],
  LOCALE_NAMES: { en: 'English', zh: '中文', es: 'Español' },
  i18n: {},
}));
