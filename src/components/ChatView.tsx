import { useEffect, useRef } from 'react';
import { useT } from '../i18n';
import { useChatStore } from '../store/useChatStore';
import { useOllamaStatus } from '../store/useOllamaStatus';
import { useSettingsStore } from '../store/useSettingsStore';
import MessageBubble from './MessageBubble';
import { useScrollFade } from '../utils/useScrollFade';

/** Within this distance from the bottom the view keeps following new text. */
const STICKY_PX = 40;

export default function ChatView() {
  const messages = useChatStore((s) => s.messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  useScrollFade(scrollRef);

  // A newly sent message always jumps to the bottom...
  useEffect(() => {
    followRef.current = true;
  }, [messages.length]);

  // ...but streamed text only scrolls if the user has not scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) followRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
  };

  return (
    // The global user-select:none (needed for dragging and buttons) is lifted here, so messages,
    // statistics and errors can be selected and copied.
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="scroll-fade chat-scroll flex-1 select-text space-y-3 overflow-y-auto px-5 py-2"
    >
      {messages.length === 0 && <EmptyState />}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  const code = useOllamaStatus((s) => s.code);
  const check = useOllamaStatus((s) => s.check);
  const host = useSettingsStore((s) => s.settings.ollamaHost);
  const model = useSettingsStore((s) => s.settings.ollamaModel);

  const problem =
    code === 'model_missing'
      ? { title: t('modelMissing.title'), body: t('modelMissing.body', { model }) }
      : code === 'unreachable' || code === 'timeout' || code === 'http' || code === 'invalid_host'
        ? { title: t('offline.title'), body: t('offline.body', { host }) }
        : null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center" data-testid="empty-state">
      <img
        src="./haverom_mascot.png"
        alt=""
        className="mb-3 h-20 w-20 object-contain drop-shadow-[0_0_14px_rgba(98,236,190,0.55)]"
        draggable={false}
      />
      <h2 className="text-[16px] font-semibold text-text-primary">{problem ? problem.title : t('empty.title')}</h2>
      <p className="mt-1.5 max-w-[300px] text-[12.5px] leading-relaxed text-text-secondary">
        {problem ? problem.body : t('empty.subtitle')}
      </p>
      {problem && (
        <button
          type="button"
          onClick={() => void check()}
          className="mt-3 rounded-lg border border-haverom-light-green/40 bg-haverom-light-green/10 px-3 py-1.5 text-[12px] font-medium text-haverom-light-green hover:bg-haverom-light-green/20"
        >
          {t('offline.retry')}
        </button>
      )}
    </div>
  );
}
