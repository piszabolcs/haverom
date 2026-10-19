import { app, Menu, nativeImage, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { translate } from '../src/i18n/strings';
import { AppSettings } from './shared';
import { hideWindow, markQuitting, showWindow } from './window';

let tray: Tray | null = null;

// Vite copies public/ into dist/; in development the icon is read from public/ directly.
// A missing icon must not stop the app, so it falls back to an empty image and logs.
function loadTrayIcon(): Electron.NativeImage {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'haverom_icon.ico'),
    path.join(app.getAppPath(), 'public', 'haverom_icon.ico')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  console.error('Tray icon haverom_icon.ico not found in dist/ or public/; using an empty icon.');
  return nativeImage.createEmpty();
}

interface TrayCallbacks {
  getSettings: () => AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  autostartAvailable: () => boolean;
}

export function createTray(callbacks: TrayCallbacks): void {
  try {
    tray = new Tray(loadTrayIcon());
    tray.setToolTip('Haverom');
    tray.on('click', () => showWindow());
    rebuildMenu(callbacks);
  } catch (err) {
    console.error('Failed to create the tray icon:', err);
  }
}

/** Rebuilt after every settings change, so labels follow the UI language. */
export function rebuildMenu(callbacks: TrayCallbacks): void {
  if (!tray) return;
  const settings = callbacks.getSettings();
  const t = (key: Parameters<typeof translate>[1]) => translate(settings.language, key);
  const menu = Menu.buildFromTemplate([
    { label: t('tray.open'), click: () => showWindow() },
    { label: t('tray.hide'), click: () => hideWindow() },
    { type: 'separator' },
    {
      label: t('tray.alwaysOnTop'),
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: (item) => callbacks.updateSettings({ alwaysOnTop: item.checked })
    },
    {
      label: t('tray.startWithWindows'),
      type: 'checkbox',
      checked: settings.startWithWindows,
      enabled: callbacks.autostartAvailable(),
      click: (item) => callbacks.updateSettings({ startWithWindows: item.checked })
    },
    { type: 'separator' },
    {
      label: t('tray.quit'),
      click: () => {
        markQuitting();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(menu);
}
