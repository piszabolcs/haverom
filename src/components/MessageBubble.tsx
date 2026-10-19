import { useT, type StringKey } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';
import type { ChatErrorCode, ChatMessage } from '../types/chat';
import { formatTime } from '../utils/formatting';
import AssistantResponseCard from './AssistantResponseCard';

const ERROR_TEXT: Record<ChatErrorCode, StringKey> = {
  unreachable: 'error.unreachable',
  timeout: 'error.timeout',
  model_missing: 'error.model_missing',
  http: 'error.http',
  stream: 'error.stream',
  empty: 'error.empty',
  invalid_host: 'error.invalid_host',
  memory: 'error.memory',
  bridge: 'error.bridge'
};

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const t = useT();
  const language = useSettingsStore((s) => s.settings.language);
  const time = (
    <p className={`mt-1 text-[10px] text-text-secondary/70 ${message.role === 'user' ? 'text-right' : ''}`}>
      {formatTime(message.timestamp, language)}
    </p>
  );

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div
            style={{
              backgroundImage:
                'linear-gradient(to bottom right, rgb(var(--haverom-light-green-rgb) / 0.9), rgb(var(--haverom-green-rgb)))'
            }}
            className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
          >
            {message.content}
          </div>
          {time}
        </div>
      </div>
    );
  }

  if (message.errorCode || message.error) {
    const text = message.errorCode
      ? t(ERROR_TEXT[message.errorCode], { detail: message.errorDetail ?? '' })
      : message.content;
    return (
      <div className="flex justify-start">
        <div className="max-w-[92%]">
          <div
            role="alert"
            data-testid="error-message"
            className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger"
          >
            {text}
          </div>
          {time}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[95%]">
        <AssistantResponseCard
          content={message.content}
          thinking={message.thinking}
          stats={message.stats}
          streaming={message.streaming}
          stopped={message.stopped}
          contextFallback={message.contextFallback}
        />
        {time}
      </div>
    </div>
  );
}
