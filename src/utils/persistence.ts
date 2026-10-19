import type { ChatMessage } from '../types/chat';

const KEY = 'haverom-conversation-v1';

export interface PersistedConversation {
  conversationId: string;
  messages: ChatMessage[];
}

export function saveConversation(data: PersistedConversation): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    // Quota exceeded or storage disabled: the chat still works, it just won't survive a restart.
    console.warn('Could not save the conversation:', err);
  }
}

export function loadConversation(): PersistedConversation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedConversation) : null;
  } catch (err) {
    console.warn('Could not restore the saved conversation:', err);
    return null;
  }
}
