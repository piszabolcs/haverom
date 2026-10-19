import { useEffect, useId, useRef, useState } from 'react';
import { isHttpUrl, isModelTag } from '../../electron/validate';
import { useT } from '../i18n';
import { useScrollFade } from '../utils/useScrollFade';
import { useOllamaStatus } from '../store/useOllamaStatus';
import { useSettingsStore } from '../store/useSettingsStore';
import { CONTEXT_SIZE_OPTIONS, MAX_IDLE_TIMEOUT_SEC } from '../types/settings';
import type { BubbleCorner, Language } from '../types/settings';
import { useDialog } from './useDialog';

interface Props {
  onClose: () => void;
}

type TestState = { state: 'idle' | 'testing' } | { state: 'done'; ok: boolean; message: string };

const inputClass =
  'w-full rounded-lg border border-white/15 bg-[var(--haverom-input-bg)] px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-secondary/40 focus:border-haverom-light-green/60';

export default function SettingsModal({ onClose }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const autostartAvailable = useSettingsStore((s) => s.autostartAvailable);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const status = useOllamaStatus();
  const t = useT();
  const ids = useId();

  // Text fields are edited locally and saved on blur/Enter: one write per edit, not per keystroke.
  const [host, setHost] = useState(settings.ollamaHost);
  const [model, setModel] = useState(settings.ollamaModel);
  const [timeout, setTimeoutDraft] = useState(String(settings.ollamaIdleTimeoutSec));
  const [test, setTest] = useState<TestState>({ state: 'idle' });

  const [memory, setMemory] = useState('');
  const [savedMemory, setSavedMemory] = useState('');
  const [memoryStatus, setMemoryStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [memoryLoadError, setMemoryLoadError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [copied, setCopied] = useState(false);
  const memoryDirty = memory !== savedMemory;

  useEffect(() => {
    window.companion
      ?.getMemory()
      .then((content) => {
        setMemory(content);
        setSavedMemory(content);
      })
      .catch((err: unknown) => setMemoryLoadError(err instanceof Error ? err.message : String(err)));
    // Fresh model list (and status) every time the dialog opens.
    void useOllamaStatus.getState().check();
  }, []);

  const requestClose = () => {
    if (memoryDirty) setConfirmDiscard(true);
    else onClose();
  };
  const dialogRef = useDialog<HTMLDivElement>(requestClose);
  const bodyRef = useRef<HTMLDivElement>(null);
  useScrollFade(bodyRef);

  const hostValid = isHttpUrl(host.trim());
  const modelValid = isModelTag(model.trim());
  const timeoutNumber = Number(timeout);
  const timeoutValid =
    timeout.trim() !== '' && Number.isInteger(timeoutNumber) && timeoutNumber >= 0 && timeoutNumber <= MAX_IDLE_TIMEOUT_SEC;

  const commitHost = () => {
    if (hostValid && host.trim() !== settings.ollamaHost) void updateSettings({ ollamaHost: host.trim() });
  };
  const commitModel = () => {
    if (modelValid && model.trim() !== settings.ollamaModel) void updateSettings({ ollamaModel: model.trim() });
  };
  const commitTimeout = () => {
    if (timeoutValid && timeoutNumber !== settings.ollamaIdleTimeoutSec) {
      void updateSettings({ ollamaIdleTimeoutSec: timeoutNumber });
    }
  };
  const commitOnEnter = (commit: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
  };

  const runTest = async () => {
    setTest({ state: 'testing' });
    await useOllamaStatus.getState().check();
    const s = useOllamaStatus.getState();
    const { ollamaHost, ollamaModel } = useSettingsStore.getState().settings;
    const vars = {
      model: ollamaModel,
      host: ollamaHost,
      detail: s.detail ?? '',
      models: s.models.length > 0 ? s.models.join(', ') : t('test.noModels')
    };
    const key =
      s.code === 'ok' ? 'test.ok'
      : s.code === 'model_missing' ? 'test.model_missing'
      : s.code === 'timeout' ? 'test.timeout'
      : s.code === 'http' ? 'test.http'
      : s.code === 'invalid_host' ? 'test.invalid_host'
      : 'test.unreachable';
    setTest({ state: 'done', ok: s.code === 'ok', message: t(key, vars) });
  };

  const saveMemory = async () => {
    try {
      if (!window.companion) throw new Error('bridge unavailable');
      // The main process returns what is actually on disk; anything else means the save failed.
      const persisted = await window.companion.saveMemory(memory);
      if (persisted !== memory) throw new Error('content on disk differs');
      setSavedMemory(memory);
      setMemoryStatus('saved');
      setTimeout(() => setMemoryStatus('idle'), 1500);
    } catch {
      setMemoryStatus('error');
    }
  };

  const diagnosticsText = [
    `Ollama host: ${settings.ollamaHost}`,
    `Model: ${settings.ollamaModel}`,
    `Context: ${settings.ollamaContextSize}`,
    `Language: ${settings.language}`
  ].join('\n');

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn('Clipboard is not available:', err);
    }
  };

  const titleId = `${ids}-title`;
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-black/50"
      onClick={requestClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="settings-dialog"
        // Grows with the window: full width on the small panel, up to 680 px when enlarged.
        // Fixed header, scrolling body: the body fades at its edges and its scrollbar stays
        // inside the rounded panel instead of running into the corners.
        className="glass-panel panel-opaque mx-4 flex max-h-[90%] w-full max-w-[680px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h2 id={titleId} className="text-[15px] font-semibold text-text-primary">
            {t('settings.title')}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            title={t('settings.close')}
            aria-label={t('settings.close')}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {confirmDiscard && (
          <div role="alertdialog" aria-label={t('settings.discardPrompt')} className="mx-5 mb-3 shrink-0 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-[12px] text-text-primary">{t('settings.discardPrompt')}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-warning/50 px-3 py-1 text-[12px] text-warning hover:bg-warning/10">
                {t('settings.discard')}
              </button>
              <button type="button" onClick={() => setConfirmDiscard(false)} className="rounded-md border border-white/15 px-3 py-1 text-[12px] text-text-primary hover:bg-white/10">
                {t('settings.keepEditing')}
              </button>
            </div>
          </div>
        )}

        <div
          ref={bodyRef}
          data-testid="settings-body"
          className="scroll-fade chat-scroll mb-3 mr-1.5 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pl-5 pr-3.5 pt-1"
        >
          <Field label={t('settings.language')}>
            <Segmented
              value={settings.language}
              options={[
                { value: 'en', label: 'English' },
                { value: 'hu', label: 'Magyar' }
              ]}
              onChange={(v) => void updateSettings({ language: v as Language })}
            />
          </Field>

          <Toggle label={t('settings.alwaysOnTop')} checked={settings.alwaysOnTop} onChange={(v) => void updateSettings({ alwaysOnTop: v })} />
          <div>
            <Toggle
              label={t('settings.startWithWindows')}
              checked={settings.startWithWindows}
              disabled={!autostartAvailable}
              onChange={(v) => void updateSettings({ startWithWindows: v })}
            />
            {!autostartAvailable && <Help>{t('settings.autostartUnavailable')}</Help>}
          </div>
          <Toggle label={t('settings.largeText')} checked={settings.largeText} onChange={(v) => void updateSettings({ largeText: v })} />
          <Toggle label={t('settings.highContrast')} checked={settings.highContrast} onChange={(v) => void updateSettings({ highContrast: v })} />
          <div>
            <Toggle
              label={t('settings.showHardware')}
              checked={settings.showHardwareMonitor}
              onChange={(v) => void updateSettings({ showHardwareMonitor: v })}
            />
            <Help>{t('settings.showHardwareHelp')}</Help>
          </div>

          <Field label={t('settings.bubbleCorner')} htmlFor={`${ids}-corner`}>
            <select
              id={`${ids}-corner`}
              value={settings.bubbleCorner}
              onChange={(e) => void updateSettings({ bubbleCorner: e.target.value as BubbleCorner })}
              className={inputClass}
            >
              <option value="bottom-right">{t('settings.cornerBR')}</option>
              <option value="bottom-left">{t('settings.cornerBL')}</option>
            </select>
          </Field>

          <Divider />

          <Field label={t('settings.ollamaHost')} htmlFor={`${ids}-host`}>
            <input
              id={`${ids}-host`}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              onBlur={commitHost}
              onKeyDown={commitOnEnter(commitHost)}
              placeholder="http://localhost:11434"
              aria-invalid={!hostValid}
              className={inputClass}
            />
            {!hostValid && <ErrorText>{t('settings.hostInvalid')}</ErrorText>}
          </Field>

          <Field label={t('settings.ollamaModel')} htmlFor={`${ids}-model`}>
            <input
              id={`${ids}-model`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={commitModel}
              onKeyDown={commitOnEnter(commitModel)}
              placeholder="qwen3:4b"
              list={`${ids}-models`}
              aria-invalid={!modelValid}
              className={inputClass}
            />
            <datalist id={`${ids}-models`}>
              {status.models.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {modelValid ? <Help>{t('settings.ollamaModelHelp')}</Help> : <ErrorText>{t('settings.modelInvalid')}</ErrorText>}
          </Field>

          <Field label={t('settings.contextSize')} htmlFor={`${ids}-ctx`}>
            <select
              id={`${ids}-ctx`}
              value={settings.ollamaContextSize}
              onChange={(e) => void updateSettings({ ollamaContextSize: Number(e.target.value) })}
              className={inputClass}
            >
              {CONTEXT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Help>{t('settings.contextSizeHelp')}</Help>
          </Field>

          <Field label={t('settings.idleTimeout')} htmlFor={`${ids}-timeout`}>
            <input
              id={`${ids}-timeout`}
              type="number"
              min={0}
              max={MAX_IDLE_TIMEOUT_SEC}
              step={30}
              value={timeout}
              onChange={(e) => setTimeoutDraft(e.target.value)}
              onBlur={commitTimeout}
              onKeyDown={commitOnEnter(commitTimeout)}
              aria-invalid={!timeoutValid}
              className={inputClass}
            />
            {timeoutValid ? <Help>{t('settings.idleTimeoutHelp')}</Help> : <ErrorText>{t('settings.idleTimeoutInvalid')}</ErrorText>}
          </Field>

          <button
            type="button"
            onClick={() => void runTest()}
            disabled={test.state === 'testing'}
            className="w-full rounded-lg border border-haverom-light-green/40 bg-haverom-light-green/10 px-3 py-2 text-[12px] font-medium text-haverom-light-green transition-colors hover:bg-haverom-light-green/20 disabled:opacity-40"
          >
            {test.state === 'testing' ? t('settings.testing') : t('settings.testConnection')}
          </button>
          {test.state === 'done' && (
            <p role="status" data-testid="test-result" className={`text-[11px] leading-snug ${test.ok ? 'text-success' : 'text-danger'}`}>
              {test.message}
            </p>
          )}

          <Divider />

          <Field label={t('settings.memory')} htmlFor={`${ids}-memory`}>
            <textarea
              id={`${ids}-memory`}
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              rows={5}
              placeholder={t('settings.memoryPlaceholder')}
              className={`${inputClass} resize-none font-mono`}
            />
            {memoryLoadError ? (
              <ErrorText>{t('settings.memoryLoadError', { detail: memoryLoadError })}</ErrorText>
            ) : (
              <Help>{t('settings.memoryHelp')}</Help>
            )}
            <button
              type="button"
              onClick={() => void saveMemory()}
              disabled={!memoryDirty && memoryStatus !== 'error'}
              className="mt-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12.5px] font-medium text-text-primary transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {memoryStatus === 'saved' ? t('settings.memorySaved') : t('settings.memorySave')}
            </button>
            {memoryDirty && memoryStatus !== 'error' && (
              <p className="mt-1.5 text-[11px] leading-snug text-warning">{t('settings.memoryUnsaved')}</p>
            )}
            {memoryStatus === 'error' && <ErrorText>{t('settings.memorySaveError')}</ErrorText>}
          </Field>

          <Divider />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                {t('settings.diagnostics')}
              </span>
              <button
                type="button"
                onClick={() => void copyDiagnostics()}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10.5px] text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
              >
                {copied ? t('settings.copied') : t('settings.copy')}
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-[var(--haverom-diag-bg)] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-text-secondary">
              {diagnosticsText}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-text-secondary/70">{children}</p>;
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-danger">{children}</p>;
}

function Divider() {
  return <div className="h-px bg-white/10" />;
}

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-haverom-light-green/25 text-haverom-light-green'
              : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-[12.5px] text-text-primary">{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-haverom-light-green' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
