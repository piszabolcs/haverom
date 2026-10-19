import { useEffect, useState } from 'react';
import FloatingBubble from './components/FloatingBubble';
import CompanionPanel from './components/CompanionPanel';
import { useSettingsStore } from './store/useSettingsStore';
import { useChatStore } from './store/useChatStore';

export default function App() {
  const [expanded, setExpanded] = useState(false);
  const bootstrap = useSettingsStore((s) => s.bootstrap);
  const loaded = useSettingsStore((s) => s.loaded);
  const highContrast = useSettingsStore((s) => s.settings.highContrast);
  const language = useSettingsStore((s) => s.settings.language);

  useEffect(() => {
    void bootstrap().then(() => {
      // Restore the saved conversation.
      useChatStore.getState().restore();
    });
  }, [bootstrap]);

  // High-contrast mode: a class on the root element (CSS overrides).
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  // Document language, for hyphenation and screen readers.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const expand = async () => {
    // Resize the window first, then show the panel.
    await window.companion?.setExpanded(true);
    setExpanded(true);
  };

  const collapse = async () => {
    setExpanded(false);
    await window.companion?.setExpanded(false);
  };

  if (!loaded) return null;

  return (
    <div className="h-full w-full">
      {expanded ? (
        <CompanionPanel onCollapse={() => void collapse()} />
      ) : (
        <FloatingBubble onOpen={() => void expand()} />
      )}
    </div>
  );
}
