import {
  AppSettings,
  CONTEXT_SIZE_OPTIONS,
  DEFAULT_SETTINGS,
  MAX_IDLE_TIMEOUT_SEC,
  OllamaChatMessage,
  OllamaChatStreamRequest
} from './shared';

// Validation for everything that crosses the IPC boundary or is read back from disk.
// The renderer is treated as untrusted: a compromised page must not be able to store
// arbitrary settings, point the main process at a non-HTTP URL or flood the disk.

export const MAX_MEMORY_BYTES = 1_000_000;
const MAX_PROMPT_CHARS = 2_000_000;
const MAX_MESSAGES = 1_000;

type Validator = (value: unknown) => boolean;

const isBool: Validator = (v) => typeof v === 'boolean';
const oneOf =
  (values: readonly unknown[]): Validator =>
  (v) =>
    values.includes(v);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for an absolute http:// or https:// URL with a host name. */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/** Ollama model tags such as `qwen3:4b` or `hf.co/user/repo:Q4_K_M`. */
export function isModelTag(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._\-:/]{0,199}$/.test(value);
}

const SETTING_VALIDATORS: Record<keyof AppSettings, Validator> = {
  alwaysOnTop: isBool,
  startWithWindows: isBool,
  language: oneOf(['en', 'hu']),
  largeText: isBool,
  highContrast: isBool,
  bubbleCorner: oneOf(['bottom-right', 'bottom-left']),
  windowMode: oneOf(['compact', 'half', 'full']),
  ollamaHost: isHttpUrl,
  ollamaModel: isModelTag,
  ollamaContextSize: oneOf(CONTEXT_SIZE_OPTIONS),
  ollamaIdleTimeoutSec: (v) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_IDLE_TIMEOUT_SEC,
  showHardwareMonitor: isBool
};

function validatorFor(key: string): Validator | undefined {
  return Object.prototype.hasOwnProperty.call(SETTING_VALIDATORS, key)
    ? SETTING_VALIDATORS[key as keyof AppSettings]
    : undefined;
}

/** Validates a settings patch from the renderer. All-or-nothing: throws on any unknown key or bad value. */
export function parseSettingsPatch(input: unknown): Partial<AppSettings> {
  if (!isPlainObject(input)) throw new Error('Settings patch must be an object');
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const validate = validatorFor(key);
    if (!validate) throw new Error(`Unknown setting: ${key}`);
    if (!validate(value)) throw new Error(`Invalid value for setting: ${key}`);
    patch[key] = value;
  }
  return patch as Partial<AppSettings>;
}

/**
 * Repairs settings read from disk: keeps every known key with a valid value and falls back to
 * the default for the rest. `rejected` lists the keys that were dropped (for the log).
 */
export function sanitizeSettings(input: unknown): { settings: AppSettings; rejected: string[] } {
  const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const rejected: string[] = [];
  if (!isPlainObject(input)) return { settings: settings as unknown as AppSettings, rejected: ['<root>'] };
  for (const [key, value] of Object.entries(input)) {
    const validate = validatorFor(key);
    if (validate && validate(value)) settings[key] = value;
    else rejected.push(key);
  }
  return { settings: settings as unknown as AppSettings, rejected };
}

export function parseStreamId(input: unknown): string {
  if (typeof input !== 'string' || !/^[\w-]{1,100}$/.test(input)) throw new Error('Invalid stream id');
  return input;
}

/** Validates a chat request: a stream id plus a bounded list of system/user/assistant messages. */
export function parseChatRequest(input: unknown): OllamaChatStreamRequest {
  if (!isPlainObject(input)) throw new Error('Chat request must be an object');
  const streamId = parseStreamId(input.streamId);
  const raw = input.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    throw new Error('Invalid message list');
  }
  let totalChars = 0;
  const messages: OllamaChatMessage[] = raw.map((m) => {
    if (!isPlainObject(m) || !oneOf(['system', 'user', 'assistant'])(m.role) || typeof m.content !== 'string') {
      throw new Error('Invalid chat message');
    }
    totalChars += m.content.length;
    return { role: m.role as OllamaChatMessage['role'], content: m.content };
  });
  if (totalChars > MAX_PROMPT_CHARS) throw new Error('Prompt is too large');
  return { streamId, messages };
}

/** Validates the custom-instructions text before it is written to disk. */
export function parseMemory(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Memory must be a string');
  if (new TextEncoder().encode(input).length > MAX_MEMORY_BYTES) {
    throw new Error('Memory is larger than 1 MB');
  }
  return input;
}
