import { ChatError, type AiProvider } from './AiProvider';
import { translate } from '../i18n/strings';
import type { AiRequest, AiResponse, AiResponseDelta } from '../types/chat';
import type { Language } from '../types/settings';

const DATE_LOCALE: Record<Language, string> = { en: 'en-US', hu: 'hu-HU' };

/**
 * The model does not know today's date, and its training data stops at some point. Every request
 * therefore carries the real date and an explicit rule: Haverom has no internet access, so for
 * time-sensitive facts the model must say its knowledge may be outdated instead of guessing.
 * The text comes from the i18n table in the UI language (English by default), so the model
 * answers in the language the user reads.
 */
export function systemPrompt(language: Language, now = new Date()): string {
  const date = now.toLocaleDateString(DATE_LOCALE[language], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  return translate(language, 'prompt.system', { date });
}

function customInstructionsPrompt(memory: string, language: Language): string {
  return translate(language, 'prompt.customInstructions', { instructions: memory.trim() });
}

/**
 * Builds the prompt layers (persona + date → custom instructions → history → message) and
 * streams the reply through the preload bridge. Host, model and limits are applied by the
 * main process from the saved settings.
 */
export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';

  async sendMessage(
    request: AiRequest,
    onDelta?: (delta: AiResponseDelta) => void
  ): Promise<AiResponse> {
    if (!window.companion) throw new ChatError('bridge');

    // Read the instructions fresh for every request (cheap local file read), so a change saved
    // in Settings applies immediately.
    let memory: string;
    try {
      memory = await window.companion.getMemory();
    } catch (err) {
      throw new ChatError('memory', err instanceof Error ? err.message : String(err));
    }

    const messages = [
      { role: 'system' as const, content: systemPrompt(request.language) },
      ...(memory.trim()
        ? [{ role: 'system' as const, content: customInstructionsPrompt(memory, request.language) }]
        : []),
      ...request.history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: request.message }
    ];

    const result = await window.companion.ollamaChatStream(
      { streamId: request.streamId, messages },
      (chunk) => {
        if (!chunk.contentDelta && !chunk.thinkingDelta) return;
        onDelta?.({ content: chunk.contentDelta, thinking: chunk.thinkingDelta });
      }
    );

    if (!result.ok) {
      const { code, detail } = result.error ?? { code: 'unreachable' as const };
      throw new ChatError(code, detail, { content: result.message, thinking: result.thinking });
    }
    return {
      message: result.message,
      thinking: result.thinking,
      stats: result.stats,
      contextFallback: result.contextFallback
    };
  }
}
