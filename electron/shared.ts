// Types and defaults shared by the Electron main process, the preload bridge and the renderer.
// This file is the single source of truth: the renderer imports it instead of keeping copies.

export type Language = 'en' | 'hu';

export type BubbleCorner = 'bottom-right' | 'bottom-left';

/** Size of the open panel: compact box, half screen (snapped to a side) or the full work area. */
export type WindowMode = 'compact' | 'half' | 'full';

/** Selectable Ollama context sizes (num_ctx). The out-of-memory fallback ladder uses them too. */
export const CONTEXT_SIZE_OPTIONS = [8192, 16384, 32768, 65536] as const;

/** Upper bound for the idle timeout setting (seconds). */
export const MAX_IDLE_TIMEOUT_SEC = 3600;

export interface AppSettings {
  alwaysOnTop: boolean;
  startWithWindows: boolean;
  language: Language;
  /** Larger text (zoom) for readability. */
  largeText: boolean;
  highContrast: boolean;
  bubbleCorner: BubbleCorner;
  windowMode: WindowMode;
  /** Ollama service URL, e.g. http://localhost:11434 */
  ollamaHost: string;
  /** Ollama model tag, e.g. qwen3:4b */
  ollamaModel: string;
  /** Ollama context size (num_ctx), one of CONTEXT_SIZE_OPTIONS. */
  ollamaContextSize: number;
  /** How long the model may send nothing before the request is aborted. 0 = no limit. */
  ollamaIdleTimeoutSec: number;
  /** Show the VRAM/RAM bars (polls nvidia-smi while the panel is open). */
  showHardwareMonitor: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: true,
  startWithWindows: false,
  language: 'en',
  largeText: false,
  highContrast: false,
  bubbleCorner: 'bottom-right',
  windowMode: 'compact',
  ollamaHost: 'http://localhost:11434',
  // A small model that loads on modest hardware; any pulled model can be picked in Settings.
  ollamaModel: 'qwen3:4b',
  ollamaContextSize: 8192,
  ollamaIdleTimeoutSec: 120,
  showHardwareMonitor: false
};

export interface BootstrapData {
  settings: AppSettings;
  appVersion: string;
  /** Start-with-Windows is only offered for the packaged app on Windows. */
  autostartAvailable: boolean;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaStats {
  promptTokens: number;
  evalTokens: number;
  tokensPerSecond: number;
}

/** One streamed piece on the main → renderer push channel. */
export interface OllamaChatChunk {
  streamId: string;
  contentDelta?: string;
  thinkingDelta?: string;
  done: boolean;
}

/**
 * What the renderer sends: only the prompt. Host, model, context size and timeout are taken
 * from the main-process settings, so the renderer cannot point requests at arbitrary URLs.
 */
export interface OllamaChatStreamRequest {
  streamId: string;
  messages: OllamaChatMessage[];
}

/** A fully resolved chat request (main process only). */
export interface OllamaChatParams extends OllamaChatStreamRequest {
  host: string;
  model: string;
  /** Ollama num_ctx. When undefined, Ollama uses its own default. */
  contextSize?: number;
  /** Idle timeout in seconds. 0 = no limit, undefined = built-in default. */
  idleTimeoutSec?: number;
}

/**
 * Why a chat request failed. The main process only reports codes (plus a technical detail);
 * the renderer turns them into text in the user's language.
 */
export type OllamaErrorCode =
  | 'unreachable'
  | 'timeout'
  | 'cancelled'
  | 'model_missing'
  | 'http'
  | 'stream'
  | 'empty'
  | 'invalid_host';

export interface OllamaFailure {
  code: OllamaErrorCode;
  detail?: string;
}

export interface OllamaChatStreamResult {
  ok: boolean;
  /** The reply text; for a cancelled request, the part that arrived before Stop. */
  message: string;
  thinking?: string;
  stats?: OllamaStats;
  /** Set when the context size was lowered automatically after an out-of-memory error. */
  contextFallback?: { from: number; to: number };
  /** Set when ok is false. */
  error?: OllamaFailure;
}

export type OllamaStatusCode = 'ok' | 'model_missing' | 'unreachable' | 'timeout' | 'http' | 'invalid_host';

/** Result of probing the configured host and model (GET /api/tags). */
export interface OllamaStatus {
  code: OllamaStatusCode;
  /** Tags of the models pulled on that host (empty when it is not reachable). */
  models: string[];
  detail?: string;
}

/** Current GPU state (nvidia-smi). Null on machines without an NVIDIA GPU. */
export interface GpuInfo {
  memoryUsedMb: number;
  memoryTotalMb: number;
  utilizationPercent: number;
  temperatureC: number;
}

/** Current system RAM state (the whole machine, not just Haverom). */
export interface RamInfo {
  usedMb: number;
  totalMb: number;
}

export const IPC = {
  GET_BOOTSTRAP: 'app:get-bootstrap',
  UPDATE_SETTINGS: 'settings:update',
  SETTINGS_CHANGED: 'settings:changed',
  SET_EXPANDED: 'window:set-expanded',
  OLLAMA_CHAT_STREAM: 'ollama:chat-stream',
  OLLAMA_CHAT_CHUNK: 'ollama:chat-chunk',
  OLLAMA_CANCEL: 'ollama:cancel',
  OLLAMA_STATUS: 'ollama:status',
  GET_MEMORY: 'memory:get',
  SAVE_MEMORY: 'memory:save',
  QUERY_GPU: 'gpu:query',
  QUERY_RAM: 'ram:query'
} as const;
