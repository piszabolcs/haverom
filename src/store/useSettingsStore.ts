import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../types/settings';
import type { AppSettings } from '../types/settings';

interface SettingsState {
  settings: AppSettings;
  /** From package.json via app.getVersion(); empty until the bootstrap arrives. */
  appVersion: string;
  autostartAvailable: boolean;
  loaded: boolean;
  bootstrap: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  appVersion: '',
  autostartAvailable: false,
  loaded: false,

  bootstrap: async () => {
    // In a plain browser (Vite dev without Electron) the defaults are used.
    if (!window.companion) {
      set({ loaded: true });
      return;
    }
    const data = await window.companion.getBootstrap();
    set({
      settings: data.settings,
      appVersion: data.appVersion,
      autostartAvailable: data.autostartAvailable,
      loaded: true
    });
    window.companion.onSettingsChanged((settings) => set({ settings }));
  },

  updateSettings: async (partial) => {
    if (window.companion) {
      const settings = await window.companion.updateSettings(partial);
      set({ settings });
    } else {
      set((state) => ({ settings: { ...state.settings, ...partial } }));
    }
  }
}));
