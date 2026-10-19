import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readMemory } from './memory';
import { DEFAULT_SETTINGS } from './shared';
import { loadSettings, saveSettings } from './settingsStore';

const dirs: string[] = [];
function tempFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haverom-test-'));
  dirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('settings file', () => {
  it('round-trips through an atomic save without leaving temp files behind', () => {
    const file = tempFile('settings.json');
    saveSettings({ ...DEFAULT_SETTINGS, language: 'hu' }, file);
    expect(loadSettings(file).language).toBe('hu');
    expect(fs.readdirSync(path.dirname(file))).toEqual(['settings.json']);
  });

  it('moves a corrupt file to .bak and falls back to the defaults', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = tempFile('settings.json');
    fs.writeFileSync(file, '{ not json');
    expect(loadSettings(file)).toEqual(DEFAULT_SETTINGS);
    expect(fs.readFileSync(`${file}.bak`, 'utf-8')).toBe('{ not json');
  });
});

describe('readMemory', () => {
  it('treats a missing file as empty but reports other read errors', () => {
    const file = tempFile('memory.md');
    expect(readMemory(file)).toBe('');
    fs.mkdirSync(file); // a directory cannot be read as a file
    expect(() => readMemory(file)).toThrow();
  });
});
