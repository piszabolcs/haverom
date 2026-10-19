import {
  CONTEXT_SIZE_OPTIONS,
  OllamaChatChunk,
  OllamaChatParams,
  OllamaChatStreamResult,
  OllamaErrorCode,
  OllamaStats,
  OllamaStatus
} from './shared';

/**
 * An idle limit, not a total one: every received piece restarts it. Loading a model can take a
 * while, and a fixed total timeout would cut off a reply that is still making progress.
 * The setting overrides it; 0 disables it.
 */
const DEFAULT_IDLE_TIMEOUT_SEC = 120;
/** /api/tags is local and tiny: no answer within this time means the host is not responding. */
const STATUS_TIMEOUT_MS = 4_000;

/** A failure with a stable code; the renderer turns the code into a localized message. */
export class OllamaError extends Error {
  constructor(
    readonly code: OllamaErrorCode,
    readonly detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

/** Joins the configured host and an API path. Tolerates a trailing slash and a path prefix. */
export function ollamaUrl(host: string, apiPath: string): string {
  try {
    return new URL(apiPath, host.endsWith('/') ? host : `${host}/`).toString();
  } catch {
    throw new OllamaError('invalid_host', host);
  }
}

/** True when two model tags name the same model (`llama3` is short for `llama3:latest`). */
export function sameModel(a: string, b: string): boolean {
  const withTag = (m: string) => {
    const tag = m.trim().toLowerCase();
    return tag.includes(':') ? tag : `${tag}:latest`;
  };
  return withTag(a) === withTag(b);
}

/**
 * The Ollama stream is NDJSON: one JSON object per line. Network chunks can split a line
 * anywhere, so the unfinished last line is returned as the remainder for the next round.
 * A malformed line is skipped instead of failing the whole reply.
 */
export function parseNdjsonLines(buffer: string): { events: unknown[]; remainder: string } {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';
  const events: unknown[] = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* skip the broken line */
    }
  }
  return { events, remainder };
}

export function computeStats(
  promptEvalCount: number,
  evalCount: number,
  evalDurationNs: number
): OllamaStats {
  const tokensPerSecond = evalDurationNs > 0 ? evalCount / (evalDurationNs / 1e9) : 0;
  return {
    promptTokens: promptEvalCount,
    evalTokens: evalCount,
    tokensPerSecond: Math.round(tokensPerSecond * 10) / 10
  };
}

interface OllamaStreamLine {
  message?: { content?: string; thinking?: string };
  error?: string;
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface Reply {
  content: string;
  thinking: string;
  stats?: OllamaStats;
}

/** Ollama reports errors as `{"error": "..."}`; other servers may answer with plain text. */
function errorMessageFromBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    /* not JSON */
  }
  return body.trim().slice(0, 300);
}

async function httpError(res: Response, model: string): Promise<OllamaError> {
  const message = errorMessageFromBody(await res.text().catch(() => ''));
  // Only Ollama's own "model ... not found" means the model is missing; any other 404
  // (a different service on the port, a wrong path prefix) is reported as an HTTP error.
  if (res.status === 404 && /model\b.*not found/i.test(message)) {
    return new OllamaError('model_missing', model);
  }
  return new OllamaError('http', `HTTP ${res.status}${message ? ` – ${message}` : ''}`);
}

/** Short technical reason for a failed fetch, e.g. ECONNREFUSED instead of "fetch failed". */
function describeFetchError(err: unknown): string {
  const cause = (err as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  if (cause && typeof cause.message === 'string') return cause.message;
  return err instanceof Error ? err.message : String(err);
}

/** Sends the conversation and streams the reply into `reply`, piece by piece. */
async function streamReply(
  req: OllamaChatParams,
  reply: Reply,
  onChunk: (chunk: OllamaChatChunk) => void,
  signal: AbortSignal,
  onActivity: () => void
): Promise<void> {
  const body: Record<string, unknown> = { model: req.model, messages: req.messages, stream: true };
  if (req.contextSize) body.options = { num_ctx: req.contextSize };

  const res = await fetch(ollamaUrl(req.host, 'api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw await httpError(res, req.model);
  if (!res.body) throw new OllamaError('empty');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onActivity();
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseNdjsonLines(buffer);
    buffer = parsed.remainder;

    for (const raw of parsed.events) {
      const line = raw as OllamaStreamLine;
      // Ollama can fail mid-stream (e.g. while loading the model) with an error line.
      if (typeof line.error === 'string') throw new OllamaError('stream', line.error);
      const contentDelta = line.message?.content || undefined;
      const thinkingDelta = line.message?.thinking || undefined;
      if (contentDelta) reply.content += contentDelta;
      if (thinkingDelta) reply.thinking += thinkingDelta;
      if (contentDelta || thinkingDelta) {
        onChunk({ streamId: req.streamId, contentDelta, thinkingDelta, done: false });
      }
      if (line.done) {
        reply.stats = computeStats(
          line.prompt_eval_count ?? 0,
          line.eval_count ?? 0,
          line.eval_duration ?? 0
        );
      }
    }
  }
}

function failure(code: OllamaErrorCode, detail?: string): OllamaChatStreamResult {
  return { ok: false, message: '', error: { code, detail } };
}

/**
 * Streams one chat reply. It ends early when the user cancels (`cancelSignal`; the text received
 * so far is returned) or when the model sends nothing for the idle timeout.
 */
export async function ollamaChatStream(
  req: OllamaChatParams,
  onChunk: (chunk: OllamaChatChunk) => void,
  cancelSignal?: AbortSignal
): Promise<OllamaChatStreamResult> {
  const controller = new AbortController();
  let abortedBy: 'cancel' | 'timeout' | undefined;
  const abort = (by: 'cancel' | 'timeout') => {
    abortedBy ??= by;
    controller.abort();
  };
  const onCancel = () => abort('cancel');
  if (cancelSignal?.aborted) abort('cancel');
  cancelSignal?.addEventListener('abort', onCancel);

  const idleSec = req.idleTimeoutSec ?? DEFAULT_IDLE_TIMEOUT_SEC;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const restartIdleTimer = () => {
    clearTimeout(idleTimer);
    if (idleSec > 0) idleTimer = setTimeout(() => abort('timeout'), idleSec * 1000);
  };
  restartIdleTimer();

  const reply: Reply = { content: '', thinking: '' };
  try {
    if (abortedBy) throw new Error('aborted before start');
    await streamReply(req, reply, onChunk, controller.signal, restartIdleTimer);
    onChunk({ streamId: req.streamId, done: true });
    if (!reply.content && !reply.thinking) return failure('empty');
    return {
      ok: true,
      message: reply.content,
      thinking: reply.thinking || undefined,
      stats: reply.stats
    };
  } catch (err) {
    if (abortedBy === 'cancel') {
      return {
        ok: false,
        message: reply.content,
        thinking: reply.thinking || undefined,
        error: { code: 'cancelled' }
      };
    }
    if (abortedBy === 'timeout') return failure('timeout', String(idleSec));
    if (err instanceof OllamaError) return failure(err.code, err.detail);
    return failure('unreachable', describeFetchError(err));
  } finally {
    clearTimeout(idleTimer);
    cancelSignal?.removeEventListener('abort', onCancel);
  }
}

/** Probes the host and checks that the configured model is pulled (exact tag match). */
export async function checkOllama(host: string, model: string): Promise<OllamaStatus> {
  try {
    const res = await fetch(ollamaUrl(host, 'api/tags'), {
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS)
    });
    if (!res.ok) return { code: 'http', models: [], detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { models?: { name?: unknown }[] };
    const models = (data.models ?? [])
      .map((m) => m.name)
      .filter((name): name is string => typeof name === 'string');
    return { code: models.some((name) => sameModel(name, model)) ? 'ok' : 'model_missing', models };
  } catch (err) {
    if (err instanceof OllamaError) return { code: 'invalid_host', models: [], detail: host };
    if ((err as { name?: string } | null)?.name === 'TimeoutError') {
      return { code: 'timeout', models: [] };
    }
    return { code: 'unreachable', models: [], detail: describeFetchError(err) };
  }
}

/**
 * Ollama error patterns that mean memory ran out. Measured with a 30B model on 8 GB VRAM +
 * 32 GB RAM: "failed to allocate buffer of size ..." and "unable to allocate CUDA_Host buffer",
 * sometimes with "reported out-of-memory during startup".
 */
const MEMORY_ERROR_PATTERN =
  /out of memory|out-of-memory|requires more system memory|cuda error|failed to allocate|unable to allocate|insufficient memory|not enough memory/i;

export function isMemoryExhaustionError(message: string): boolean {
  return MEMORY_ERROR_PATTERN.test(message);
}

function nextLowerContextSize(current: number): number | undefined {
  const lower = CONTEXT_SIZE_OPTIONS.filter((size) => size < current);
  return lower.length > 0 ? lower[lower.length - 1] : undefined;
}

/**
 * Fallback around ollamaChatStream: when the configured context size fails with an explicit
 * out-of-memory error, retry one step lower on the CONTEXT_SIZE_OPTIONS ladder, down to the
 * smallest. A successful but lowered attempt is reported in `contextFallback`. Silent slowdowns
 * cannot be detected, only Ollama's explicit errors.
 */
export async function ollamaChatStreamWithFallback(
  req: OllamaChatParams,
  onChunk: (chunk: OllamaChatChunk) => void,
  cancelSignal?: AbortSignal
): Promise<OllamaChatStreamResult> {
  const startSize = req.contextSize;
  if (startSize === undefined) return ollamaChatStream(req, onChunk, cancelSignal);

  let currentSize = startSize;
  for (;;) {
    const result = await ollamaChatStream({ ...req, contextSize: currentSize }, onChunk, cancelSignal);
    if (result.ok) {
      return currentSize === startSize
        ? result
        : { ...result, contextFallback: { from: startSize, to: currentSize } };
    }
    if (!isMemoryExhaustionError(result.error?.detail ?? '')) return result;

    const lower = nextLowerContextSize(currentSize);
    if (lower === undefined) return result;
    currentSize = lower;
  }
}
