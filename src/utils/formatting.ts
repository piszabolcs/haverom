import type { Language } from '../types/settings';

export function formatTime(timestamp: number, language: Language): string {
  return new Date(timestamp).toLocaleTimeString(language === 'hu' ? 'hu-HU' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
