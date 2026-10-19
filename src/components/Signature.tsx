import { useId, useState } from 'react';
import { useT } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDialog } from './useDialog';

const BUILT_WITH = ['TypeScript', 'Electron', 'React', 'Vite', 'Tailwind CSS', 'Zustand', 'react-markdown'];

/**
 * Author signature in the footer: bare `psz // v{version}` text with an accent glow on hover
 * and keyboard focus. It opens a compact About card. The version comes from package.json via
 * app.getVersion() (bootstrap), the single source of truth.
 */
export default function Signature() {
  const version = useSettingsStore((s) => s.appVersion);
  const [open, setOpen] = useState(false);
  const t = useT();
  if (!version) return null;

  return (
    <>
      <button
        type="button"
        className="signature shrink-0"
        title={t('about.open')}
        aria-haspopup="dialog"
        data-testid="signature"
        onClick={() => setOpen(true)}
      >
        psz // v{version}
      </button>
      {open && <AboutDialog version={version} onClose={() => setOpen(false)} />}
    </>
  );
}

function AboutDialog({ version, onClose }: { version: string; onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const ref = useDialog<HTMLDivElement>(onClose);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-black/50" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="about-dialog"
        className="glass-panel panel-opaque mx-6 w-full max-w-[360px] p-5 text-[12px] leading-relaxed text-text-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-[15px] font-semibold text-text-primary">
            Haverom <span className="ml-1 text-[12px] font-normal text-text-secondary">v{version}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            title={t('settings.close')}
            aria-label={t('settings.close')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-text-secondary hover:bg-white/10 hover:text-text-primary"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-text-primary">{t('about.purpose')}</p>

        <Section title={t('about.architecture')}>
          <ul className="space-y-0.5">
            <li>{t('about.layerMain')}</li>
            <li>{t('about.layerBridge')}</li>
            <li>{t('about.layerRenderer')}</li>
          </ul>
        </Section>

        <Section title={t('about.builtWith')}>
          <p>{BUILT_WITH.join(' · ')}</p>
        </Section>

        <Section title={t('about.repositories')}>
          <ul className="space-y-0.5">
            <li>github.com/piszabolcs/Haverom</li>
            <li>
              <a
                href="https://github.com/ollama/ollama"
                target="_blank"
                rel="noreferrer noopener"
                className="text-haverom-light-green underline underline-offset-2"
              >
                ollama/ollama
              </a>{' '}
              — {t('about.repoOllama')}
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <h3 className="mb-1 text-[10.5px] font-medium uppercase tracking-wider text-haverom-mint">{title}</h3>
      {children}
    </div>
  );
}
