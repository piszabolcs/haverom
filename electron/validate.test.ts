import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './shared';
import {
  MAX_MEMORY_BYTES,
  parseChatRequest,
  parseMemory,
  parseSettingsPatch,
  sanitizeSettings
} from './validate';

describe('parseSettingsPatch', () => {
  it('accepts a valid patch', () => {
    expect(parseSettingsPatch({ language: 'hu', ollamaHost: 'http://127.0.0.1:11434' })).toEqual({
      language: 'hu',
      ollamaHost: 'http://127.0.0.1:11434'
    });
  });

  it('rejects unknown keys, non-HTTP hosts and wrongly typed values', () => {
    expect(() => parseSettingsPatch({ webSearchEnabled: true })).toThrow('Unknown setting');
    expect(() => parseSettingsPatch({ ollamaHost: 'file:///C:/Windows' })).toThrow('ollamaHost');
    expect(() => parseSettingsPatch({ startWithWindows: 'yes' })).toThrow('startWithWindows');
    expect(() => parseSettingsPatch({ ollamaContextSize: 12345 })).toThrow('ollamaContextSize');
    expect(() => parseSettingsPatch({ ['__proto__']: {} })).toThrow();
  });
});

describe('sanitizeSettings', () => {
  it('keeps valid keys and resets broken or unknown ones to the defaults', () => {
    const { settings, rejected } = sanitizeSettings({
      language: 'hu',
      ollamaIdleTimeoutSec: -5,
      darkPersona: true
    });
    expect(settings.language).toBe('hu');
    expect(settings.ollamaIdleTimeoutSec).toBe(DEFAULT_SETTINGS.ollamaIdleTimeoutSec);
    expect(rejected.sort()).toEqual(['darkPersona', 'ollamaIdleTimeoutSec']);
  });
});

describe('parseChatRequest / parseMemory', () => {
  it('rejects malformed chat requests', () => {
    expect(() => parseChatRequest({ streamId: 's1', messages: [{ role: 'tool', content: 'x' }] })).toThrow();
    expect(() => parseChatRequest({ streamId: '../x', messages: [{ role: 'user', content: 'x' }] })).toThrow();
    expect(parseChatRequest({ streamId: 's-1', messages: [{ role: 'user', content: 'hi', extra: 1 }] })).toEqual({
      streamId: 's-1',
      messages: [{ role: 'user', content: 'hi' }]
    });
  });

  it('rejects custom instructions larger than 1 MB', () => {
    expect(() => parseMemory('x'.repeat(MAX_MEMORY_BYTES + 1))).toThrow('1 MB');
    expect(parseMemory('short')).toBe('short');
  });
});
