import type { AiRequest, AiResponse, AiResponseDelta, ChatErrorCode } from '../types/chat';

export interface AiProvider {
  readonly id: string;
  /**
   * Sends the message. With `onDelta` the provider streams: partial pieces arrive through the
   * callback, while the promise resolves with the final, authoritative reply.
   * Failures reject with a ChatError; a cancelled request rejects with code 'cancelled'.
   */
  sendMessage(request: AiRequest, onDelta?: (delta: AiResponseDelta) => void): Promise<AiResponse>;
}

/** A failed or cancelled request. `partial` holds the text that arrived before a cancel. */
export class ChatError extends Error {
  constructor(
    readonly code: ChatErrorCode | 'cancelled',
    readonly detail?: string,
    readonly partial?: { content: string; thinking?: string }
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export type { AiRequest, AiResponse, AiResponseDelta };
