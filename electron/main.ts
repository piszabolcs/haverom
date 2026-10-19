import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import { applyAutostart, isAutostartAvailable } from './autostart';
import { queryGpu } from './gpu';
import { readMemory, saveMemory } from './memory';
import { checkOllama, ollamaChatStreamWithFallback } from './ollama';
import { queryRam } from './ram';
import { AppSettings, BootstrapData, IPC } from './shared';
import { loadSettings, saveSettings } from './settingsStore';
import { createTray, rebuildMenu } from './tray';
import { parseChatRequest, parseMemory, parseSettingsPatch, parseStreamId } from './validate';
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
  setAlwaysOnTop,
  setCorner,
  setExpanded,
  setLargeText,
  setWindowMode,
  showWindow
} from './window';

let settings: AppSettings = loadSettings();

/** Running chat requests by stream id, so the Stop button can abort them. */
const activeStreams = new Map<string, AbortController>();
const cancelledEarly = new Set<string>();

const trayCallbacks = {
  getSettings: () => settings,
  updateSettings: (partial: Partial<AppSettings>) => {
    applySettingsUpdate(partial);
  },
  autostartAvailable: isAutostartAvailable
};

function applySettingsUpdate(patch: Partial<AppSettings>): AppSettings {
  const previous = settings;
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if ('alwaysOnTop' in patch) setAlwaysOnTop(settings.alwaysOnTop);
  // The login item is only touched when the user actually changes the setting.
  if ('startWithWindows' in patch && settings.startWithWindows !== previous.startWithWindows) {
    applyAutostart(settings.startWithWindows);
  }
  if ('bubbleCorner' in patch) setCorner(settings.bubbleCorner);
  if ('windowMode' in patch) setWindowMode(settings.windowMode);
  if ('largeText' in patch) setLargeText(settings.largeText);
  rebuildMenu(trayCallbacks);
  getMainWindow()?.webContents.send(IPC.SETTINGS_CHANGED, settings);
  return settings;
}

/** Only the app's own top-level page may call into the main process. */
function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const win = getMainWindow();
  const frame = event.senderFrame;
  if (!win || win.isDestroyed() || event.sender.id !== win.webContents.id) return false;
  if (!frame || frame.parent !== null) return false;
  const expectedPrefix = process.env.VITE_DEV_SERVER_URL ?? 'file://';
  return frame.url.startsWith(expectedPrefix);
}

function handle(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error(`Rejected ${channel} from an untrusted sender`);
    return listener(event, ...args);
  });
}

function registerIpcHandlers(): void {
  handle(
    IPC.GET_BOOTSTRAP,
    (): BootstrapData => ({
      settings,
      appVersion: app.getVersion(),
      autostartAvailable: isAutostartAvailable()
    })
  );

  handle(IPC.UPDATE_SETTINGS, (_event, raw) => {
    const patch = parseSettingsPatch(raw);
    if (patch.startWithWindows === true && !isAutostartAvailable()) {
      throw new Error('Start with Windows is only available in the packaged app');
    }
    return applySettingsUpdate(patch);
  });

  handle(IPC.SET_EXPANDED, (_event, expanded) => {
    setExpanded(expanded === true);
  });

  // Streamed pieces go out on a push channel; the final result resolves the invoke promise
  // (see ollamaChatStream in preload.ts). Host, model and limits come from the saved settings.
  handle(IPC.OLLAMA_CHAT_STREAM, async (event, raw) => {
    const request = parseChatRequest(raw);
    const controller = new AbortController();
    activeStreams.set(request.streamId, controller);
    if (cancelledEarly.delete(request.streamId)) controller.abort();
    try {
      const result = await ollamaChatStreamWithFallback(
        {
          ...request,
          host: settings.ollamaHost,
          model: settings.ollamaModel,
          contextSize: settings.ollamaContextSize,
          idleTimeoutSec: settings.ollamaIdleTimeoutSec
        },
        (chunk) => {
          if (!event.sender.isDestroyed()) event.sender.send(IPC.OLLAMA_CHAT_CHUNK, chunk);
        },
        controller.signal
      );
      if (result.contextFallback) {
        applySettingsUpdate({ ollamaContextSize: result.contextFallback.to });
      }
      return result;
    } finally {
      activeStreams.delete(request.streamId);
    }
  });

  // Stop button. A cancel can overtake its own request (the renderer reads the custom
  // instructions first), so unknown ids are remembered briefly and applied on arrival.
  handle(IPC.OLLAMA_CANCEL, (_event, raw) => {
    const streamId = parseStreamId(raw);
    const controller = activeStreams.get(streamId);
    if (controller) {
      controller.abort();
    } else {
      cancelledEarly.add(streamId);
      if (cancelledEarly.size > 20) cancelledEarly.delete(cancelledEarly.values().next().value!);
    }
  });

  handle(IPC.OLLAMA_STATUS, () => checkOllama(settings.ollamaHost, settings.ollamaModel));

  handle(IPC.GET_MEMORY, () => readMemory());

  // Read the file back after writing and return what is actually on disk, so the renderer
  // can verify the save really happened. fs errors reject the renderer's promise.
  handle(IPC.SAVE_MEMORY, (_event, raw) => {
    saveMemory(parseMemory(raw));
    return readMemory();
  });

  // Polled by the renderer only while the panel is open.
  handle(IPC.QUERY_GPU, () => queryGpu());
  handle(IPC.QUERY_RAM, () => queryRam());
}

// Single instance: a second launch brings the existing window forward.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    // Handlers first: if the window or tray fails later, the renderer can still bootstrap.
    registerIpcHandlers();
    createMainWindow(
      settings.alwaysOnTop,
      settings.bubbleCorner,
      settings.largeText,
      settings.windowMode
    );
    createTray(trayCallbacks);
  });

  app.on('before-quit', () => markQuitting());

  // Tray app: keep running after every window is closed.
  app.on('window-all-closed', () => {
    // intentionally empty – the tray keeps the app alive
  });
}
