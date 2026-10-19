import { describe, expect, it, vi } from 'vitest';

vi.mock('child_process', () => ({
  execFile: vi.fn((_file: string, _args: string[], _options: unknown, callback: (err: Error) => void) =>
    callback(Object.assign(new Error('spawn nvidia-smi ENOENT'), { code: 'ENOENT' }))
  )
}));

import { execFile } from 'child_process';
import { parseGpuCsv, queryGpu } from './gpu';

describe('parseGpuCsv', () => {
  it('parses the nvidia-smi CSV line, tolerating spaces and a trailing newline', () => {
    expect(parseGpuCsv('5821, 8188, 5, 52')).toEqual({
      memoryUsedMb: 5821,
      memoryTotalMb: 8188,
      utilizationPercent: 5,
      temperatureC: 52
    });
    expect(parseGpuCsv('  1024,8188,0,40  \n')?.temperatureC).toBe(40);
  });

  it('returns null for empty, incomplete or non-numeric output', () => {
    expect(parseGpuCsv('   \n')).toBeNull();
    expect(parseGpuCsv('5821, 8188')).toBeNull();
    expect(parseGpuCsv('[N/A], [N/A], [N/A], [N/A]')).toBeNull();
  });
});

describe('queryGpu', () => {
  it('stops spawning nvidia-smi once it turned out to be missing', async () => {
    expect(await queryGpu()).toBeNull();
    expect(await queryGpu()).toBeNull();
    expect(execFile).toHaveBeenCalledTimes(1);
  });
});
