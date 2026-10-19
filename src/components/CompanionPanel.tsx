import { useEffect, useState } from 'react';
import Header from './Header';
import HardwareMonitor from './HardwareMonitor';
import ChatView from './ChatView';
import InputBox from './InputBox';
import SettingsModal from './SettingsModal';
import Signature from './Signature';
import StatusIndicator from './StatusIndicator';
import { useChatStore } from '../store/useChatStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { conversationToMarkdown } from '../utils/transcript';

interface Props {
  onCollapse: () => void;
}

export default function CompanionPanel({ onCollapse }: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [conversationCopied, setConversationCopied] = useState(false);
  const [focused, setFocused] = useState(() => document.hasFocus());
  const sending = useChatStore((s) => s.sending);
  const messages = useChatStore((s) => s.messages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stop = useChatStore((s) => s.stop);
  const clearConversation = useChatStore((s) => s.clearConversation);
  const settings = useSettingsStore((s) => s.settings);

  // Active window (focused or hovered) → opaque background, inactive → translucent.
  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  const opaque = hovered || focused;

  const handleSend = (text: string) => {
    void sendMessage({ text, settings });
  };

  const copyConversation = async () => {
    try {
      await navigator.clipboard.writeText(conversationToMarkdown(messages, settings.language));
      setConversationCopied(true);
      setTimeout(() => setConversationCopied(false), 1500);
    } catch (err) {
      console.warn('Clipboard is not available:', err);
    }
  };

  const alignClass = settings.bubbleCorner === 'bottom-left' ? 'justify-start' : 'justify-end';

  return (
    <div
      className={`flex h-full w-full items-end ${alignClass} p-4`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`glass-panel panel-in relative flex h-full w-full flex-col overflow-hidden ${
          opaque ? 'panel-opaque' : 'panel-translucent'
        }`}
      >
        <Header
          onCollapse={onCollapse}
          onOpenSettings={() => setSettingsOpen(true)}
          onNewConversation={() => clearConversation()}
          onCopyConversation={() => void copyConversation()}
          copied={conversationCopied}
          hasMessages={messages.length > 0}
          busy={sending}
        />
        <HardwareMonitor />
        <ChatView />
        <InputBox busy={sending} onSend={handleSend} onStop={stop} />

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-2">
          <StatusIndicator />
          <Signature />
        </div>

        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    </div>
  );
}
