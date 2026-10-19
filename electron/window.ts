import { BrowserWindow, screen, shell } from 'electron';
import * as path from 'path';
import { BubbleCorner, WindowMode } from './shared';

// One frameless, transparent window that switches between two states:
//   - collapsed: a small floating bubble in the chosen bottom corner
//   - expanded:  the chat panel (compact box / half screen / full work area), freely
//                resizable at its edges

const MARGIN = 16;
// The collapsed window is larger than the 68 px bubble so its soft shadow fits inside
// (otherwise the transparent window's edge would cut it off square).
const COLLAPSED = { width: 140, height: 140 };
const EXPANDED = { width: 452, height: 652 }; // 420x620 panel + 16 px shadow margin all around
// Lower limit for manual resizing: below this the header buttons would collide.
const MIN_EXPANDED = { width: 380, height: 420 };
/** Zoom factor of the "Large text" setting. */
const LARGE_TEXT_ZOOM = 1.18;

let mainWindow: BrowserWindow | null = null;
let expanded = false;
// Windows tends to drop the always-on-top flag after setBounds/show/setResizable,
// so it is stored and re-applied after each of those.
let alwaysOnTop = true;
let corner: BubbleCorner = 'bottom-right';
let mode: WindowMode = 'compact';
let largeText = false;

function zoomFactor(): number {
  return largeText ? LARGE_TEXT_ZOOM : 1;
}

/**
 * Panel sizes grow with the zoom, so large text keeps the same CSS layout instead of squeezing
 * it (at 1.18 the 452 px panel would only be 383 CSS px wide). Never larger than the work area.
 */
function zoomed(size: { width: number; height: number }) {
  const workArea = screen.getPrimaryDisplay().workArea;
  return {
    width: Math.min(Math.round(size.width * zoomFactor()), workArea.width - 2 * MARGIN),
    height: Math.min(Math.round(size.height * zoomFactor()), workArea.height - 2 * MARGIN)
  };
}

function cornerBounds(size: { width: number; height: number }) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const y = workArea.y + workArea.height - size.height - MARGIN;
  const x =
    corner === 'bottom-left'
      ? workArea.x + MARGIN
      : workArea.x + workArea.width - size.width - MARGIN;
  return { x, y, width: size.width, height: size.height };
}

/**
 * Where the open panel goes, by mode. Half and full mode reach the edge of the work area –
 * the breathing room comes from the panel's own 16 px padding, not from a window margin.
 */
function expandedBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  if (mode === 'full') {
    return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height };
  }
  if (mode === 'half') {
    const width = Math.floor(workArea.width / 2);
    const x = corner === 'bottom-left' ? workArea.x : workArea.x + workArea.width - width;
    return { x, y: workArea.y, width, height: workArea.height };
  }
  return cornerBounds(zoomed(EXPANDED));
}

/**
 * The bubble has a fixed size, so the panel's minimum must be lifted before collapsing,
 * otherwise it would inflate the 140 px bubble. Order matters when expanding:
 * setResizable(true) resets the size constraints, so the minimum is set after it.
 */
function applySizeConstraints(): void {
  if (!mainWindow) return;
  if (expanded) {
    mainWindow.setResizable(true);
    const min = zoomed(MIN_EXPANDED);
    mainWindow.setMinimumSize(min.width, min.height);
  } else {
    mainWindow.setResizable(false);
    mainWindow.setMinimumSize(COLLAPSED.width, COLLAPSED.height);
  }
}

function applyZoom(): void {
  mainWindow?.webContents.setZoomFactor(zoomFactor());
}

function reapplyAlwaysOnTop(): void {
  if (!mainWindow || !alwaysOnTop) return;
  // Without the false step Windows sometimes ignores a repeated true.
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

export function createMainWindow(
  initialAlwaysOnTop: boolean,
  initialCorner: BubbleCorner,
  initialLargeText: boolean,
  initialMode: WindowMode
): BrowserWindow {
  corner = initialCorner;
  largeText = initialLargeText;
  mode = initialMode;
  alwaysOnTop = initialAlwaysOnTop;
  mainWindow = new BrowserWindow({
    ...cornerBounds(COLLAPSED),
    icon: path.join(__dirname, '..', 'dist', 'haverom_icon.ico'),
    frame: false,
    transparent: true,
    // Fixed as a bubble; setExpanded allows resizing when the panel opens.
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop,
    hasShadow: false, // no square OS shadow around the transparent window
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    reapplyAlwaysOnTop();
  });
  // The zoom factor can only be applied once the content has loaded.
  mainWindow.webContents.on('did-finish-load', () => applyZoom());

  // Links in a reply open in the system browser, never inside the app window
  // (the app must not be navigated away).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  // Closing hides to the tray instead of quitting.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
}

let quitting = false;
export function markQuitting(): void {
  quitting = true;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setExpanded(value: boolean): void {
  if (!mainWindow) return;
  expanded = value;
  if (expanded) {
    // Final place and size first, the minimum after it: setting the minimum on the small
    // bubble window would make Windows grow it from its top-left corner past the screen
    // edge (possibly onto another monitor with a different scale) and size the panel wrongly.
    const target = expandedBounds();
    mainWindow.setResizable(true);
    mainWindow.setBounds(target);
    applySizeConstraints();
    mainWindow.setBounds(target);
  } else {
    applySizeConstraints();
    mainWindow.setBounds(cornerBounds(COLLAPSED));
  }
  // Most important after collapsing: without it the bubble slips behind other windows.
  reapplyAlwaysOnTop();
}

export function setWindowMode(value: WindowMode): void {
  mode = value;
  // As a bubble only the mode is remembered; it applies when the panel opens.
  if (expanded) mainWindow?.setBounds(expandedBounds());
  reapplyAlwaysOnTop();
}

export function showWindow(): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  reapplyAlwaysOnTop();
}

export function hideWindow(): void {
  mainWindow?.hide();
}

export function setAlwaysOnTop(value: boolean): void {
  alwaysOnTop = value;
  if (value) reapplyAlwaysOnTop();
  else mainWindow?.setAlwaysOnTop(false);
}

export function setCorner(value: BubbleCorner): void {
  corner = value;
  // Keep the current state (bubble or panel) and move it to the new corner.
  mainWindow?.setBounds(expanded ? expandedBounds() : cornerBounds(COLLAPSED));
  reapplyAlwaysOnTop();
}

export function setLargeText(value: boolean): void {
  largeText = value;
  applyZoom();
  if (expanded) {
    applySizeConstraints();
    if (mode === 'compact') mainWindow?.setBounds(expandedBounds());
  }
}
