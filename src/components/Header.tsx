import { useSettingsStore } from '../store/useSettingsStore';
import { useT } from '../i18n';
import type { WindowMode } from '../types/settings';

interface Props {
  onCollapse: () => void;
  onOpenSettings: () => void;
  onNewConversation: () => void;
  onCopyConversation: () => void;
  /** True while the "copied" confirmation is shown. */
  copied: boolean;
  /** Nothing to copy or clear: the conversation buttons are disabled. */
  hasMessages: boolean;
  busy: boolean;
}

export default function Header({
  onCollapse,
  onOpenSettings,
  onNewConversation,
  onCopyConversation,
  copied,
  hasMessages,
  busy
}: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const t = useT();

  // Both size buttons toggle: clicking the active one returns to the compact panel.
  const toggleMode = (target: WindowMode) => {
    void updateSettings({ windowMode: settings.windowMode === target ? 'compact' : target });
  };

  return (
    <div className="drag-region px-5 pb-3 pt-4">
      {/* Wraps instead of overlapping when the panel is very narrow. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        {/* Left: title + conversation actions */}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="shrink-0 text-[15px] font-semibold tracking-wide text-text-primary">Haverom</h1>
          <span className="h-4 w-px shrink-0 bg-white/15" />
          <div className="no-drag flex items-center gap-1">
            <HeaderButton
              title={t('panel.newConversation')}
              onClick={onNewConversation}
              disabled={busy || !hasMessages}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </HeaderButton>
            <HeaderButton
              title={copied ? t('panel.copied') : t('panel.copyConversation')}
              onClick={onCopyConversation}
              disabled={!hasMessages}
              active={copied}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </HeaderButton>
          </div>
        </div>

        {/* Right: window actions */}
        <div className="no-drag flex shrink-0 items-center gap-1">
          <HeaderButton
            title={t('header.halfScreen')}
            active={settings.windowMode === 'half'}
            pressed={settings.windowMode === 'half'}
            onClick={() => toggleMode('half')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M13 4v16" />
              <path d="M16 9h2M16 12h2M16 15h2" strokeWidth="1.6" />
            </svg>
          </HeaderButton>
          <HeaderButton
            title={t('header.fullScreen')}
            active={settings.windowMode === 'full'}
            pressed={settings.windowMode === 'full'}
            onClick={() => toggleMode('full')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </HeaderButton>

          <span className="mx-0.5 h-4 w-px bg-white/15" />

          <HeaderButton
            title={settings.alwaysOnTop ? t('header.pinOn') : t('header.pinOff')}
            active={settings.alwaysOnTop}
            pressed={settings.alwaysOnTop}
            onClick={() => void updateSettings({ alwaysOnTop: !settings.alwaysOnTop })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 17v5" />
              <path d="M9 3h6l1 7 2 3H6l2-3 1-7z" />
            </svg>
          </HeaderButton>
          <HeaderButton title={t('header.settings')} onClick={onOpenSettings}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </HeaderButton>
          <HeaderButton title={t('header.collapse')} onClick={onCollapse}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </HeaderButton>
        </div>
      </div>
    </div>
  );
}

function HeaderButton({
  title,
  active,
  pressed,
  disabled,
  onClick,
  children
}: {
  title: string;
  active?: boolean;
  /** Set only for toggle buttons (exposed as aria-pressed). */
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors
        disabled:cursor-not-allowed disabled:opacity-30
        ${
          active
            ? 'border-haverom-light-green/50 bg-haverom-light-green/20 text-haverom-light-green'
            : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary'
        }`}
    >
      {children}
    </button>
  );
}
