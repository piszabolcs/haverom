import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkOllama,
  computeStats,
  isMemoryExhaustionError,
  ollamaChatStream,
  ollamaChatStreamWithFallback,
  parseNdjsonLines
} from './ollama';
import type { OllamaChatChunk, OllamaChatParams } from './shared';

const HOST = 'http://localhost:11434';
const MODEL = 'qwen3:4b';

function params(partial: Partial<OllamaChatParams> = {}): OllamaChatParams {
  return { streamId: 's1', host: HOST, model: MODEL, messages: [{ role: 'user', content: 'Hi' }], ...partial };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A complete final line with statistics – enough for most tests. */
function doneLine(content: string): string {
  return JSON.stringify({
    message: { content },
    done: true,
    prompt_eval_count: 10,
    eval_count: 20,
    eval_duration: 2_000_000_000
  });
}

/** A response body that delivers `lines`, then stalls until the request is aborted. */
function streamBody(lines: string[], signal?: AbortSignal, stallAtEnd = false) {
  let i = 0;
  return {
    getReader: () => ({
      read: () => {
        if (i < lines.length) {
          const value = new TextEncoder().encode(lines[i++] + '\n');
          return Promise.resolve({ done: false, value });
        }
        if (!stallAtEnd) return Promise.resolve({ done: true, value: undefined });
        const aborted = () => new Error('This operation was aborted');
        if (signal?.aborted) return Promise.reject(aborted());
        return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(aborted())));
      }
    })
  };
}

function stubStream(lines: string[], stallAtEnd = false) {
  const fetchMock = vi.fn(async (_url: string, init: { signal: AbortSignal; body: string }) => ({
    ok: true,
    status: 200,
    body: streamBody(lines, init.signal, stallAtEnd)
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubHttpError(status: number, body: string) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status, text: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('parseNdjsonLines', () => {
  it('parses complete lines and keeps the unfinished remainder', () => {
    expect(parseNdjsonLines('{"a":1}\n{"b":2}\n{"c"')).toEqual({ events: [{ a: 1 }, { b: 2 }], remainder: '{"c"' });
    expect(parseNdjsonLines('')).toEqual({ events: [], remainder: '' });
  });

  it('skips a malformed line instead of failing the whole reply', () => {
    expect(parseNdjsonLines('{"a":1}\nnot json\n{"b":2}\n').events).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('computeStats', () => {
  it('computes tokens per second, and 0 for a zero duration', () => {
    expect(computeStats(72, 288, 6_516_849_000).tokensPerSecond).toBeCloseTo(44.2, 1);
    expect(computeStats(10, 5, 0).tokensPerSecond).toBe(0);
  });
});

describe('ollamaChatStream', () => {
  it('streams chunks and resolves with the full reply and statistics', async () => {
    stubStream([
      JSON.stringify({ message: { content: '', thinking: 'Hmm' }, done: false }),
      JSON.stringify({ message: { content: 'Hi' }, done: false }),
      JSON.stringify({ message: { content: '!' }, done: false }),
      doneLine('')
    ]);
    const chunks: OllamaChatChunk[] = [];

    const result = await ollamaChatStream(params(), (c) => chunks.push(c));

    expect(result).toEqual({
      ok: true,
      message: 'Hi!',
      thinking: 'Hmm',
      stats: { promptTokens: 10, evalTokens: 20, tokensPerSecond: 10 }
    });
    expect(chunks.map((c) => c.contentDelta ?? c.thinkingDelta ?? 'done')).toEqual(['Hmm', 'Hi', '!', 'done']);
  });

  it('sends num_ctx only when a context size is set, to a normalized URL', async () => {
    const fetchMock = stubStream([doneLine('ok')]);
    await ollamaChatStream(params({ host: `${HOST}/`, contextSize: 16384 }), () => {});
    await ollamaChatStream(params(), () => {});

    expect(fetchMock.mock.calls[0][0]).toBe(`${HOST}/api/chat`);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual({ num_ctx: 16384 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).options).toBeUndefined();
  });

  it('reports model_missing only for Ollama\'s own "model not found" 404', async () => {
    stubHttpError(404, '{"error":"model \\"qwen3:30b\\" not found, try pulling it first"}');
    expect((await ollamaChatStream(params(), () => {})).error).toEqual({ code: 'model_missing', detail: MODEL });

    stubHttpError(404, '404 page not found');
    expect((await ollamaChatStream(params(), () => {})).error).toEqual({
      code: 'http',
      detail: 'HTTP 404 – 404 page not found'
    });
  });

  it('includes the error body of other HTTP failures', async () => {
    stubHttpError(500, '{"error":"model requires more system memory (17.2 GiB) than is available"}');
    const result = await ollamaChatStream(params(), () => {});
    expect(result.error?.code).toBe('http');
    expect(result.error?.detail).toContain('requires more system memory');
  });

  it('reports a network failure as unreachable with the low-level reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }))
    );
    expect((await ollamaChatStream(params(), () => {})).error).toEqual({ code: 'unreachable', detail: 'ECONNREFUSED' });
  });

  it('fails with "stream" when Ollama sends an error line mid-stream', async () => {
    stubStream([JSON.stringify({ message: { content: 'Par' } }), JSON.stringify({ error: 'llama runner crashed' })]);
    expect((await ollamaChatStream(params(), () => {})).error).toEqual({ code: 'stream', detail: 'llama runner crashed' });
  });

  it('fails with "empty" when the stream ends without any text', async () => {
    stubStream([doneLine('')]);
    expect((await ollamaChatStream(params(), () => {})).error?.code).toBe('empty');
  });

  it('times out when the model sends nothing for the idle timeout', async () => {
    stubStream([], true);
    const result = await ollamaChatStream(params({ idleTimeoutSec: 0.05 }), () => {});
    expect(result.error).toEqual({ code: 'timeout', detail: '0.05' });
  });

  it('stops on cancel and keeps the text that already arrived', async () => {
    stubStream([JSON.stringify({ message: { content: 'Partial ' } })], true);
    const cancel = new AbortController();

    const started = Date.now();
    const result = await ollamaChatStream(params(), () => cancel.abort(), cancel.signal);

    expect(Date.now() - started).toBeLessThan(300);
    expect(result).toEqual({ ok: false, message: 'Partial ', thinking: undefined, error: { code: 'cancelled' } });
  });
});

describe('checkOllama', () => {
  function stubTags(names: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ models: names.map((name) => ({ name })) }) })
    );
  }

  it('matches the exact model tag (a model of the same family does not count)', async () => {
    stubTags(['qwen3:4b', 'llama3:latest']);
    expect(await checkOllama(HOST, 'qwen3:30b-a3b-q4_K_M')).toEqual({
      code: 'model_missing',
      models: ['qwen3:4b', 'llama3:latest']
    });
    expect((await checkOllama(HOST, 'qwen3:4b')).code).toBe('ok');
    expect((await checkOllama(HOST, 'llama3')).code).toBe('ok');
  });

  it('distinguishes an unreachable host from one that does not answer in time', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })));
    expect(await checkOllama(HOST, MODEL)).toEqual({ code: 'unreachable', models: [], detail: 'ECONNREFUSED' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')));
    expect(await checkOllama(HOST, MODEL)).toEqual({ code: 'timeout', models: [] });
  });
});

describe('isMemoryExhaustionError', () => {
  it('recognizes out-of-memory messages, including the real 30B load failure', () => {
    expect(isMemoryExhaustionError('CUDA error: out of memory')).toBe(true);
    expect(isMemoryExhaustionError('model requires more system memory than is available')).toBe(true);
    expect(
      isMemoryExhaustionError(
        'llama-server reported out-of-memory during startup: failed to allocate buffer of size 13401243648\n' +
          'error loading model: unable to allocate CUDA_Host buffer'
      )
    ).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isMemoryExhaustionError('HTTP 404 – not found')).toBe(false);
    expect(isMemoryExhaustionError('ECONNREFUSED')).toBe(false);
  });
});

describe('ollamaChatStreamWithFallback', () => {
  const oom = () => ({ ok: false, status: 500, text: async () => '{"error":"CUDA error: out of memory"}' });

  it('does not report a fallback when the first attempt succeeds', async () => {
    const fetchMock = stubStream([doneLine('ok')]);
    const result = await ollamaChatStreamWithFallback(params({ contextSize: 32768 }), () => {});
    expect(result.ok).toBe(true);
    expect(result.contextFallback).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries one step lower after an out-of-memory error and reports it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(oom())
      .mockResolvedValueOnce({ ok: true, status: 200, body: streamBody([doneLine('ok')]) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ollamaChatStreamWithFallback(params({ contextSize: 32768 }), () => {});

    expect(result.contextFallback).toEqual({ from: 32768, to: 16384 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).options).toEqual({ num_ctx: 16384 });
  });

  it('does not retry other errors', async () => {
    const fetchMock = stubHttpError(404, '{"error":"model \\"x\\" not found"}');
    await ollamaChatStreamWithFallback(params({ contextSize: 32768 }), () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the smallest context size', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => oom());
    vi.stubGlobal('fetch', fetchMock);
    const result = await ollamaChatStreamWithFallback(params({ contextSize: 32768 }), () => {});
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 32768 -> 16384 -> 8192
  });
});
