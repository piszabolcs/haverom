import { useSettingsStore } from '../store/useSettingsStore';
import { translate, type StringKey } from './strings';

export { translate };
export type { StringKey };

/** React hook: a translate function bound to the current UI language. */
export function useT() {
  const lang = useSettingsStore((s) => s.settings.language);
  return (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}
