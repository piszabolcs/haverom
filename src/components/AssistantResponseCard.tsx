import { useState } from 'react';
import Markdown from './Markdown';
import { useT } from '../i18n';
import type { OllamaStats } from '../types/chat';

interface Props {
  content: string;
  thinking?: string;
  stats?: OllamaStats;
  streaming?: boolean;
  /** The user stopped the reply; `content` is what had arrived. */
  stopped?: boolean;
  contextFallback?: { from: number; to: number };
}

export default function AssistantResponseCard({
  content,
  thinking,
  stats,
  streaming,
  stopped,
  contextFallback
}: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Clipboard is not available:', err);
    }
  };

  // Typing dots inside the card until the first piece arrives.
  const showTypingDots = streaming && !content && !thinking;

  return (
    <div className="glass-card overflow-hidden">
      {contextFallback && (
        <div className="border-b border-white/10 px-4 py-2">
          <p className="flex items-center gap-1.5 text-[10.5px] text-warning">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            {t('context.fallback', { from: contextFallback.from, to: contextFallback.to })}
          </p>
        </div>
      )}

      {thinking && (
        <details className="border-b border-white/10 px-4 py-2">
          <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wider text-haverom-mint">
            {t('thinking.label')}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-text-secondary">
            {thinking}
          </p>
        </details>
      )}

      <div className="px-4 py-3">
        {showTypingDots ? (
          <div className="flex items-center gap-1 py-1">
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-haverom-light-green" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-haverom-light-green" />
            <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-haverom-light-green" />
          </div>
        ) : (
          <Markdown content={content} />
        )}
      </div>

      {stats && (
        <p className="border-t border-white/10 px-4 py-1.5 text-[10px] text-text-secondary/60">
          {t('stats.line', {
            prompt: stats.promptTokens,
            eval: stats.evalTokens,
            tps: stats.tokensPerSecond
          })}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-warning" data-testid="stopped-label">
          {stopped ? t('card.stopped') : ''}
        </span>
        <button
          onClick={() => void copy()}
          title={t('card.copy')}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-secondary
                     transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
