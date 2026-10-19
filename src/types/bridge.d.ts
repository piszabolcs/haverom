import type { CompanionBridge } from '../../electron/preload';

export type { GpuInfo, RamInfo } from '../../electron/shared';

declare global {
  interface Window {
    /** The bridge exposed by the Electron preload script. Undefined in a plain browser (dev). */
    companion?: CompanionBridge;
  }
}
