import { create } from 'zustand';
import type { ChatMessage } from '../types/chat';
import type { AppSettings } from '../types/settings';
import { getProvider } from '../providers';
import { ChatError } from '../providers/AiProvider';
import { generateId } from '../utils/formatting';
import { buildHistory } from '../utils/history';
import { loadConversation, saveConversation } from '../utils/persistence';
import { useOllamaStatus } from './useOllamaStatus';

interface ChatState {
  conversationId: string;
  messages: ChatMessage[];
  sending: boolean;
  /** Stream id of the running request (for Stop). */
  activeStreamId: string | null;
  sendMessage: (params: { text: string; settings: AppSettings }) => Promise<void>;
  /** Stops the running reply; the text received so far stays, marked as stopped. */
  stop: () => void;
  clearConversation: () => void;
  restore: () => void;
}

function persist(get: () => ChatState): void {
  const { conversationId, messages } = get();
  saveConversation({ conversationId, messages });
}

export const useChatStore = create<ChatState>((set, get) => {
  function patchMessage(
    id: string,
    patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)
  ): void {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m
      )
    }));
  }

  return {
    conversationId: generateId('conv'),
    messages: [],
    sending: false,
    activeStreamId: null,

    sendMessage: async ({ text, settings }) => {
      if (get().sending) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      // History is taken BEFORE the new message is added, otherwise it would be sent twice.
      const history = buildHistory(get().messages);
      const userMessage: ChatMessage = {
        id: generateId('msg'),
        role: 'user',
        content: trimmed,
        timestamp: Date.now()
      };
      // The empty placeholder appears at once; streamed pieces fill it live.
      const assistantId = generateId('msg');
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: '',
        streaming: true,
        timestamp: Date.now()
      };
      const streamId = generateId('stream');
      set((state) => ({
        messages: [...state.messages, userMessage, placeholder],
        sending: true,
        activeStreamId: streamId
      }));

      try {
        const response = await getProvider().sendMessage(
          {
            conversationId: get().conversationId,
            streamId,
            language: settings.language,
            message: trimmed,
            history
          },
          (delta) => {
            patchMessage(assistantId, (m) => ({
              content: m.content + (delta.content ?? ''),
              thinking: (m.thinking ?? '') + (delta.thinking ?? '')
            }));
          }
        );
        // The final text comes from the provider (not the delta sum), so a missed chunk
        // cannot corrupt the stored reply.
        patchMessage(assistantId, {
          content: response.message,
          thinking: response.thinking,
          stats: response.stats,
          contextFallback: response.contextFallback,
          streaming: false
        });
        useOllamaStatus.setState({ code: 'ok' });
      } catch (err) {
        const error = err instanceof ChatError ? err : new ChatError('unreachable', String(err));
        if (error.code === 'cancelled') {
          patchMessage(assistantId, {
            content: error.partial?.content ?? '',
            thinking: error.partial?.thinking || undefined,
            stopped: true,
            streaming: false
          });
        } else {
          // A failed reply never shows half an answer as if it were complete.
          patchMessage(assistantId, {
            content: '',
            thinking: undefined,
            errorCode: error.code,
            errorDetail: error.detail,
            streaming: false
          });
          if (['unreachable', 'model_missing', 'timeout'].includes(error.code)) {
            void useOllamaStatus.getState().check();
          }
        }
      } finally {
        set({ sending: false, activeStreamId: null });
        persist(get);
      }
    },

    stop: () => {
      const streamId = get().activeStreamId;
      if (streamId) void window.companion?.cancelChat(streamId);
    },

    clearConversation: () => {
      set({ conversationId: generateId('conv'), messages: [], sending: false, activeStreamId: null });
      persist(get);
    },

    restore: () => {
      const saved = loadConversation();
      if (saved && saved.messages.length > 0) {
        // A reply that was still streaming when the app closed can never finish.
        const messages = saved.messages.map((m) => (m.streaming ? { ...m, streaming: false, stopped: true } : m));
        set({ conversationId: saved.conversationId, messages });
      }
    }
  };
});
