import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaProvider } from './OllamaProvider';
import { translate } from '../i18n/strings';
import type { AiRequest } from '../types/chat';
import type {
  OllamaChatChunk,
  OllamaChatStreamRequest,
  OllamaChatStreamResult
} from '../../electron/shared';

function req(partial: Partial<AiRequest>): AiRequest {
  return { conversationId: 'c1', streamId: 's1', language: 'en', message: '', history: [], ...partial };
}

function stubCompanion(opts: {
  memory?: string;
  streamResult: OllamaChatStreamResult;
  chunks?: OllamaChatChunk[];
}) {
  const ollamaChatStream = vi.fn(
    async (_request: OllamaChatStreamRequest, onChunk: (c: OllamaChatChunk) => void) => {
      for (const c of opts.chunks ?? []) onChunk(c);
      return opts.streamResult;
    }
  );
  const getMemory = vi.fn().mockResolvedValue(opts.memory ?? '');
  vi.stubGlobal('window', { companion: { ollamaChatStream, getMemory } });
  return { ollamaChatStream, getMemory };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OllamaProvider', () => {
  it('sends only the stream id and the messages through the bridge (system first, user last)', async () => {
    const { ollamaChatStream } = stubCompanion({ streamResult: { ok: true, message: 'Hi!' } });

    const res = await new OllamaProvider().sendMessage(req({ message: 'Hello' }));

    expect(res.message).toBe('Hi!');
    const call = ollamaChatStream.mock.calls[0][0];
    expect(Object.keys(call).sort()).toEqual(['messages', 'streamId']);
    expect(call.streamId).toBe('s1');
    expect(call.messages[0]).toEqual({ role: 'system', content: expect.any(String) });
    expect(call.messages.at(-1)).toEqual({ role: 'user', content: 'Hello' });
  });

  it('puts the history between the system prompt and the new message', async () => {
    const { ollamaChatStream } = stubCompanion({ streamResult: { ok: true, message: 'ok' } });

    await new OllamaProvider().sendMessage(
      req({
        message: 'second',
        history: [{ id: 'm1', role: 'user', content: 'first', timestamp: 1 }]
      })
    );

    const messages = ollamaChatStream.mock.calls[0][0].messages;
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: 'user', content: 'first' });
    expect(messages[2]).toEqual({ role: 'user', content: 'second' });
  });

  it('adds custom instructions as a second system message, but not when they are blank', async () => {
    const withNotes = stubCompanion({ memory: 'Use metric units.', streamResult: { ok: true, message: 'ok' } });
    await new OllamaProvider().sendMessage(req({ message: 'Hi' }));
    const messages = withNotes.ollamaChatStream.mock.calls[0][0].messages;
    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('system');
    expect(messages[1].content).toContain('Use metric units.');

    const blank = stubCompanion({ memory: '   ', streamResult: { ok: true, message: 'ok' } });
    await new OllamaProvider().sendMessage(req({ message: 'Hi' }));
    expect(blank.ollamaChatStream.mock.calls[0][0].messages).toHaveLength(2);
  });

  it('tells the model today\'s date and that it is offline (no web search tool)', async () => {
    const { ollamaChatStream } = stubCompanion({ streamResult: { ok: true, message: 'ok' } });

    await new OllamaProvider().sendMessage(req({ message: 'Hi' }));

    const system = ollamaChatStream.mock.calls[0][0].messages[0].content;
    expect(system).toContain(String(new Date().getFullYear()));
    expect(system).toContain('offline');
    expect(system).not.toContain('web_search');
  });

  it('takes the prompts from the i18n table in the UI language (Hungarian UI → Hungarian prompts)', async () => {
    const { ollamaChatStream } = stubCompanion({ memory: 'Légy rövid.', streamResult: { ok: true, message: 'ok' } });

    await new OllamaProvider().sendMessage(req({ language: 'hu', message: 'Szia' }));

    const [system, notes] = ollamaChatStream.mock.calls[0][0].messages;
    const today = new Date().toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    expect(system.content).toBe(translate('hu', 'prompt.system', { date: today }));
    expect(system.content).toContain('Mindig magyarul válaszolj');
    expect(notes.content).toBe(translate('hu', 'prompt.customInstructions', { instructions: 'Légy rövid.' }));
  });

  it('maps stream chunks to deltas', async () => {
    stubCompanion({
      streamResult: { ok: true, message: 'Hi!', thinking: 'Thinking' },
      chunks: [
        { streamId: 's', thinkingDelta: 'Think', done: false },
        { streamId: 's', contentDelta: 'Hi', done: false },
        { streamId: 's', done: true }
      ]
    });

    const deltas: { content?: string; thinking?: string }[] = [];
    await new OllamaProvider().sendMessage(req({ message: 'Hi' }), (d) => deltas.push(d));

    expect(deltas).toEqual([
      { content: undefined, thinking: 'Think' },
      { content: 'Hi', thinking: undefined }
    ]);
  });

  it('rejects with the coded failure reported by the bridge', async () => {
    stubCompanion({ streamResult: { ok: false, message: '', error: { code: 'unreachable', detail: 'ECONNREFUSED' } } });
    await expect(new OllamaProvider().sendMessage(req({ message: 'x' }))).rejects.toMatchObject({ code: 'unreachable', detail: 'ECONNREFUSED' });
  });

  it('throws without the Electron bridge (plain browser)', async () => {
    vi.stubGlobal('window', {});
    await expect(new OllamaProvider().sendMessage(req({ message: 'x' }))).rejects.toThrow();
  });
});
