import { app } from 'electron';

// "Start with Windows" via the Windows login-item API. Only offered for the packaged app:
// from a dev checkout it would register electron.exe plus a project path, which breaks
// as soon as the folder moves.

export function isAutostartAvailable(): boolean {
  return process.platform === 'win32' && app.isPackaged;
}

/** Applies the login-item setting. Called only when the user changes it, never at startup. */
export function applyAutostart(enabled: boolean): void {
  if (!isAutostartAvailable()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: enabled });
  } catch (err) {
    console.error('Failed to apply autostart setting:', err);
  }
}
