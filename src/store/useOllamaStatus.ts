import { create } from 'zustand';
import type { OllamaStatusCode } from '../../electron/shared';

interface OllamaStatusState {
  /** 'checking' until the first answer arrives. */
  code: OllamaStatusCode | 'checking';
  models: string[];
  detail?: string;
  /** Probes the configured host and model; overlapping calls share one request. */
  check: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useOllamaStatus = create<OllamaStatusState>((set) => ({
  code: 'checking',
  models: [],

  check: () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        if (!window.companion) {
          set({ code: 'unreachable', models: [], detail: undefined });
          return;
        }
        const status = await window.companion.checkOllama();
        set({ code: status.code, models: status.models, detail: status.detail });
      } catch (err) {
        set({ code: 'unreachable', models: [], detail: err instanceof Error ? err.message : String(err) });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }
}));
