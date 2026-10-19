import { translate } from '../i18n/strings';
import type { ChatMessage } from '../types/chat';
import type { Language } from '../types/settings';
import { formatTime } from './formatting';

/** The conversation as Markdown for the clipboard. Error bubbles are not model replies, so they are left out. */
export function conversationToMarkdown(messages: ChatMessage[], lang: Language): string {
  const lines = [`# ${translate(lang, 'transcript.title')}`, ''];
  for (const m of messages) {
    if (m.error || m.errorCode) continue;
    const who = translate(lang, m.role === 'user' ? 'transcript.user' : 'transcript.assistant');
    lines.push(`**${who}** (${formatTime(m.timestamp, lang)}):`);
    lines.push(m.content || '');
    lines.push('');
  }
  return lines.join('\n');
}
