import { useEffect } from 'react';
import { useT } from '../i18n';
import { useOllamaStatus } from '../store/useOllamaStatus';
import { useSettingsStore } from '../store/useSettingsStore';

/** Re-probe interval while the panel is open (the indicator only lives in the panel). */
const RECHECK_MS = 30_000;

/** Footer dot: green = model ready, amber = checking or model not pulled, red = Ollama unreachable. */
export default function StatusIndicator() {
  const host = useSettingsStore((s) => s.settings.ollamaHost);
  const model = useSettingsStore((s) => s.settings.ollamaModel);
  const code = useOllamaStatus((s) => s.code);
  const check = useOllamaStatus((s) => s.check);
  const t = useT();

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), RECHECK_MS);
    return () => clearInterval(timer);
  }, [host, model, check]);

  const view =
    code === 'ok'
      ? { dot: 'bg-success', label: model }
      : code === 'checking'
        ? { dot: 'bg-warning', label: t('status.checking') }
        : code === 'model_missing'
          ? { dot: 'bg-warning', label: `${model} · ${t('status.modelMissing')}` }
          : { dot: 'bg-danger', label: t('status.offline') };

  return (
    <button
      type="button"
      onClick={() => void check()}
      title={t('status.recheck')}
      data-testid="ollama-status"
      data-status={code}
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-white/5"
    >
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${view.dot}`} />
      <span className="truncate text-[11px] text-text-secondary">{view.label}</span>
    </button>
  );
}
