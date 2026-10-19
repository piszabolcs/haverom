import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../types/chat';
import { buildHistory } from './history';

const msg = (id: string, role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  content,
  timestamp: 0,
  ...extra
});

describe('buildHistory', () => {
  it('keeps completed and stopped exchanges, drops failed turns with their question', () => {
    const history = buildHistory([
      msg('1', 'user', 'first'),
      msg('2', 'assistant', '', { errorCode: 'unreachable' }),
      msg('3', 'user', 'second'),
      msg('4', 'assistant', 'answer'),
      msg('5', 'user', 'third'),
      msg('6', 'assistant', 'partial', { stopped: true }),
      msg('7', 'user', 'fourth'),
      msg('8', 'assistant', '', { stopped: true })
    ]);
    expect(history.map((m) => m.id)).toEqual(['3', '4', '5', '6']);
  });
});
