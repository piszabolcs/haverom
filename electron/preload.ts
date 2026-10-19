import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  BootstrapData,
  GpuInfo,
  IPC,
  OllamaChatChunk,
  OllamaChatStreamRequest,
  OllamaChatStreamResult,
  OllamaStatus,
  RamInfo
} from './shared';

// The renderer reaches the main process only through this narrow, typed bridge.
// Every handler on the other side validates its arguments (see validate.ts).

const companionBridge = {
  getBootstrap: (): Promise<BootstrapData> => ipcRenderer.invoke(IPC.GET_BOOTSTRAP),

  updateSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.UPDATE_SETTINGS, partial),

  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (_event: unknown, settings: AppSettings) => callback(settings);
    ipcRenderer.on(IPC.SETTINGS_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC.SETTINGS_CHANGED, listener);
  },

  setExpanded: (expanded: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_EXPANDED, expanded),

  /**
   * Streamed chat: chunks arrive on a push channel (filtered to our streamId),
   * the final result resolves the invoke promise.
   */
  ollamaChatStream: (
    request: OllamaChatStreamRequest,
    onChunk: (chunk: OllamaChatChunk) => void
  ): Promise<OllamaChatStreamResult> => {
    const listener = (_event: unknown, chunk: OllamaChatChunk) => {
      if (chunk.streamId === request.streamId) onChunk(chunk);
    };
    ipcRenderer.on(IPC.OLLAMA_CHAT_CHUNK, listener);
    return ipcRenderer
      .invoke(IPC.OLLAMA_CHAT_STREAM, request)
      .finally(() => ipcRenderer.removeListener(IPC.OLLAMA_CHAT_CHUNK, listener));
  },

  /** Stops a running chat request; the reply keeps the text received so far. */
  cancelChat: (streamId: string): Promise<void> => ipcRenderer.invoke(IPC.OLLAMA_CANCEL, streamId),

  /** Probes the configured Ollama host and model; also returns the pulled model tags. */
  checkOllama: (): Promise<OllamaStatus> => ipcRenderer.invoke(IPC.OLLAMA_STATUS),

  getMemory: (): Promise<string> => ipcRenderer.invoke(IPC.GET_MEMORY),

  // Resolves with the content actually written to disk (read back), so the caller can
  // verify the save; rejects on fs errors.
  saveMemory: (content: string): Promise<string> => ipcRenderer.invoke(IPC.SAVE_MEMORY, content),

  queryGpu: (): Promise<GpuInfo | null> => ipcRenderer.invoke(IPC.QUERY_GPU),

  queryRam: (): Promise<RamInfo> => ipcRenderer.invoke(IPC.QUERY_RAM)
};

export type CompanionBridge = typeof companionBridge;

contextBridge.exposeInMainWorld('companion', companionBridge);
