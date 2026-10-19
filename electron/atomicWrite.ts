import * as fs from 'fs';
import * as path from 'path';

/** Writes through a temp file and a rename, so a crash mid-write never leaves a truncated file. */
export function writeFileAtomic(file: string, data: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, 'utf-8');
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    // Windows can refuse the rename while another process (e.g. a virus scanner) holds the file.
    fs.rmSync(tmp, { force: true });
    throw err;
  }
}
