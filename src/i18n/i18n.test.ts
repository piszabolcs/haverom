import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translate } from './strings';

describe('i18n', () => {
  it('has exactly the same keys in English and Hungarian, none of them empty', () => {
    expect(Object.keys(DICTIONARIES.hu).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
    for (const dict of Object.values(DICTIONARIES)) {
      expect(Object.values(dict).filter((s) => s.trim() === '')).toEqual([]);
    }
  });

  it('replaces every occurrence of a variable', () => {
    expect(translate('en', 'error.model_missing', { detail: 'qwen3:4b' })).toBe(
      'The model "qwen3:4b" is not pulled yet. Run: ollama pull qwen3:4b'
    );
  });
});
