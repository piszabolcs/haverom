import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import { GpuInfo } from './shared';

const execFileAsync = promisify(execFile);

/** Timeout for one nvidia-smi call (measured at ~190 ms). */
const QUERY_TIMEOUT_MS = 4_000;

const QUERY_ARGS = [
  '--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu',
  '--format=csv,noheader,nounits'
];

/** The driver installs nvidia-smi into System32; a full path avoids picking up a planted binary from PATH. */
const NVIDIA_SMI =
  process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'nvidia-smi.exe')
    : 'nvidia-smi';

/** Set once nvidia-smi turned out to be missing: no point in spawning it again this session. */
let unavailable = false;

/**
 * Parses the single line of `nvidia-smi ... --format=csv,noheader,nounits`, e.g. "5821, 8188, 5, 52".
 * Anything unexpected (empty, [N/A], missing fields) → null.
 */
export function parseGpuCsv(raw: string): GpuInfo | null {
  const line = raw.trim().split('\n')[0]?.trim();
  if (!line) return null;

  const parts = line.split(',').map((p) => p.trim());
  if (parts.length < 4) return null;

  const numbers = parts.slice(0, 4).map((p) => Number(p));
  if (numbers.some((n) => !Number.isFinite(n))) return null;

  const [memoryUsedMb, memoryTotalMb, utilizationPercent, temperatureC] = numbers;
  return { memoryUsedMb, memoryTotalMb, utilizationPercent, temperatureC };
}

/** Current GPU state, or null without an NVIDIA GPU or on any error (the UI then hides the bar). */
export async function queryGpu(): Promise<GpuInfo | null> {
  if (unavailable) return null;
  try {
    const { stdout } = await execFileAsync(NVIDIA_SMI, QUERY_ARGS, {
      timeout: QUERY_TIMEOUT_MS,
      windowsHide: true
    });
    return parseGpuCsv(stdout);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') unavailable = true;
    return null;
  }
}
