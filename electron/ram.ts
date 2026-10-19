import * as os from 'os';
import { RamInfo } from './shared';

/**
 * Node's built-in `os` module is always available synchronously – unlike `queryGpu` there is
 * no external binary that could be missing, so no try/catch or null result is needed.
 */
export function queryRam(): RamInfo {
  const totalMb = os.totalmem() / (1024 * 1024);
  const freeMb = os.freemem() / (1024 * 1024);
  return { totalMb, usedMb: totalMb - freeMb };
}
