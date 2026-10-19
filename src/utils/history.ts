import type { ChatMessage } from '../types/chat';

/**
 * The conversation as context for the next request: completed exchanges only. A failed turn
 * is dropped together with the user message that caused it, so the model never receives several
 * unanswered user messages in a row. A stopped reply counts if some text had arrived.
 */
export function buildHistory(messages: ChatMessage[]): ChatMessage[] {
  const history: ChatMessage[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const question = messages[i];
    const reply = messages[i + 1];
    if (question.role !== 'user' || reply.role !== 'assistant') continue;
    const failed = reply.error || reply.errorCode !== undefined || reply.streaming;
    if (!failed && reply.content.trim() !== '') history.push(question, reply);
    i++;
  }
  return history;
}
