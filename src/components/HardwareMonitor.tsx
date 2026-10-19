import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';
import type { GpuInfo, RamInfo } from '../types/bridge';

const POLL_MS = 3000;

function gb(mb: number): string {
  return (mb / 1024).toFixed(1);
}

// On an 8 GB card, 90 %+ means the model is about to spill over to the CPU.
function barColorFor(ratio: number): string {
  return ratio > 0.9 ? 'bg-danger' : ratio > 0.75 ? 'bg-warning' : 'bg-haverom-light-green';
}

/**
 * Optional VRAM (NVIDIA only) and RAM bars. Off by default; when enabled it polls every few
 * seconds while the panel is open, skips a poll while the previous one is still running or the
 * window is hidden, and stops when the panel collapses to the bubble.
 */
export default function HardwareMonitor() {
  const enabled = useSettingsStore((s) => s.settings.showHardwareMonitor);
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [ram, setRam] = useState<RamInfo | null>(null);
  const t = useT();

  useEffect(() => {
    if (!enabled || !window.companion) return;
    const bridge = window.companion;
    let cancelled = false;
    let busy = false;

    const poll = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [nextGpu, nextRam] = await Promise.all([bridge.queryGpu(), bridge.queryRam()]);
        if (!cancelled) {
          setGpu(nextGpu);
          setRam(nextRam);
        }
      } catch (err) {
        console.warn('Hardware query failed:', err);
      } finally {
        busy = false;
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled || (!gpu && !ram)) return null;

  const gpuRatio = gpu && gpu.memoryTotalMb > 0 ? gpu.memoryUsedMb / gpu.memoryTotalMb : 0;
  const ramRatio = ram && ram.totalMb > 0 ? ram.usedMb / ram.totalMb : 0;

  return (
    <div className="px-5 pb-2" data-testid="hardware-monitor">
      {gpu && (
        <Bar
          label={t('gpu.line', {
            used: gb(gpu.memoryUsedMb),
            total: gb(gpu.memoryTotalMb),
            util: gpu.utilizationPercent,
            temp: gpu.temperatureC
          })}
          ratio={gpuRatio}
        />
      )}
      {ram && <Bar label={t('ram.line', { used: gb(ram.usedMb), total: gb(ram.totalMb) })} ratio={ramRatio} />}
    </div>
  );
}

function Bar({ label, ratio }: { label: string; ratio: number }) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <>
      <p className="mb-1 text-[10px] tabular-nums text-text-secondary/70">{label}</p>
      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColorFor(ratio)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  );
}
