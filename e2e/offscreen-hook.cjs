'use strict';
// Loaded with `electron -r e2e/offscreen-hook.cjs .` before the app's main.js (Playwright strips
// NODE_OPTIONS, so -r is the reliable way in). It keeps automated runs invisible:
//  - every BrowserWindow stays at (-32000,-32000) and is never activated or focused,
//  - the tray icon is replaced by a recorder (the context-menu labels can still be checked),
//  - userData points at a throwaway folder, so no real settings or conversations are touched.
const Module = require('module');
const electron = require('electron');

const { app, BrowserWindow } = electron;
const OFF = -32000;
const state = (globalThis.__e2e = { trayMenus: [], requestedBounds: [], blocked: [] });

if (process.env.HAVEROM_E2E_USER_DATA) app.setPath('userData', process.env.HAVEROM_E2E_USER_DATA);
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const P = BrowserWindow.prototype;
const original = { showInactive: P.showInactive, setBounds: P.setBounds, setPosition: P.setPosition };
P.show = function () {
  original.setPosition.call(this, OFF, OFF);
  original.showInactive.call(this);
};
for (const name of ['focus', 'moveTop', 'maximize', 'restore', 'setFullScreen', 'setSimpleFullScreen', 'setKiosk', 'center', 'flashFrame']) {
  P[name] = function () {
    state.blocked.push(name);
  };
}
// The app's requested bounds are recorded (so corner/half/full logic can be checked) but the
// window itself always stays off-screen; only the size is applied.
P.setBounds = function (bounds, animate) {
  state.requestedBounds.push(bounds);
  const current = this.getBounds();
  return original.setBounds.call(
    this,
    { x: OFF, y: OFF, width: bounds.width ?? current.width, height: bounds.height ?? current.height },
    animate
  );
};
P.setPosition = function (x, y, animate) {
  state.requestedBounds.push({ x, y });
  return original.setPosition.call(this, OFF, OFF, animate);
};

class RecordingTray {
  setToolTip() {}
  setImage() {}
  setContextMenu(menu) {
    state.trayMenus.push(
      menu.items.map((i) => ({ label: i.label, type: i.type, checked: i.checked, enabled: i.enabled }))
    );
  }
  on() {
    return this;
  }
  destroy() {}
}

const electronProxy = new Proxy(electron, {
  get: (target, key) => (key === 'Tray' ? RecordingTray : target[key])
});
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'electron') return electronProxy;
  return originalLoad.call(this, request, ...rest);
};
