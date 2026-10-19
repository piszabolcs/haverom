import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './atomicWrite';
import { AppSettings, DEFAULT_SETTINGS } from './shared';
import { sanitizeSettings } from './validate';

// JSON settings file in the Electron userData folder (%APPDATA%\Haverom on Windows).

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(file = settingsPath()): AppSettings {
  let raw: string;
  try {
    // Strip a BOM in case the file was edited by hand or another tool.
    raw = fs.readFileSync(file, 'utf-8').replace(/^\uFEFF/, '');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to read settings, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Keep the broken file for inspection instead of silently overwriting it on the next save.
    const backup = `${file}.bak`;
    try {
      fs.renameSync(file, backup);
    } catch {
      /* best effort */
    }
    console.warn(`settings.json is not valid JSON; moved it to ${backup} and started with defaults.`);
    return { ...DEFAULT_SETTINGS };
  }

  const { settings, rejected } = sanitizeSettings(parsed);
  if (rejected.length > 0) {
    console.warn(`Ignored invalid or obsolete settings: ${rejected.join(', ')}`);
  }
  return settings;
}

export function saveSettings(settings: AppSettings, file = settingsPath()): void {
  try {
    writeFileAtomic(file, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}
