import type { Language, OllamaErrorCode, OllamaStats } from '../../electron/shared';

export type { OllamaStats };

/** Failure codes shown to the user: the Ollama ones plus two that only the renderer knows. */
export type ChatErrorCode = Exclude<OllamaErrorCode, 'cancelled'> | 'memory' | 'bridge';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** The model's reply 1:1 (Markdown), or the user's message. */
  content: string;
  timestamp: number;
  /** Failed reply: the code is translated when rendered, so it follows the UI language. */
  errorCode?: ChatErrorCode;
  errorDetail?: string;
  /** Legacy (v0.1) error bubble whose text is stored in `content`. */
  error?: boolean;
  /** The user pressed Stop; `content` holds what had arrived until then. */
  stopped?: boolean;
  /** True while the reply is still streaming. */
  streaming?: boolean;
  /** The model's "thinking" text (Ollama's native thinking field), if any. */
  thinking?: string;
  /** Token statistics, only on a completed reply. */
  stats?: OllamaStats;
  /** Set when the context size was lowered automatically after an out-of-memory error. */
  contextFallback?: { from: number; to: number };
}

export interface AiRequest {
  conversationId: string;
  /** Identifies the running request, so it can be cancelled. */
  streamId: string;
  language: Language;
  message: string;
  /** Completed earlier exchanges, WITHOUT the new message. */
  history: ChatMessage[];
}

/** One streamed piece from the provider to the store. */
export interface AiResponseDelta {
  content?: string;
  thinking?: string;
}

/** The model's final reply. The app renders only `message`, 1:1, as Markdown. */
export interface AiResponse {
  message: string;
  thinking?: string;
  stats?: OllamaStats;
  contextFallback?: { from: number; to: number };
}
