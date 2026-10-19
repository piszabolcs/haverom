import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writeFileAtomic } from './atomicWrite';

// Custom instructions: a freely editable Markdown file in the userData folder whose content is
// sent to the model as a system message with every request.

function memoryPath(): string {
  return path.join(app.getPath('userData'), 'memory.md');
}

/** A missing file simply means "no instructions yet"; any other error is reported to the caller. */
export function readMemory(file = memoryPath()): string {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

export function saveMemory(content: string, file = memoryPath()): void {
  writeFileAtomic(file, content);
}
