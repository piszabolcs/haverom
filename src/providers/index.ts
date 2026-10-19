import type { AiProvider } from './AiProvider';
import { OllamaProvider } from './OllamaProvider';

const ollama = new OllamaProvider();

/** The only provider in the lite app: the local Ollama model. */
export function getProvider(): AiProvider {
  return ollama;
}
