import type { Language } from '../../electron/shared';

// Dependency-free i18n dictionaries. English is the base; the Hungarian dictionary must define
// exactly the same keys (enforced by the type and by i18n.test.ts). Variables: {name}.
// This module has no React dependency, so the main process uses it too (tray menu).

const en = {
  'header.pinOn': 'Unpin (turn always-on-top off)',
  'header.pinOff': 'Always on top',
  'header.settings': 'Settings',
  'header.collapse': 'Collapse to bubble',
  'header.halfScreen': 'Half screen',
  'header.fullScreen': 'Full screen',
  'panel.newConversation': 'New conversation',
  'panel.copyConversation': 'Copy conversation',
  'panel.copied': 'Copied',

  'empty.title': 'How can I help?',
  'empty.subtitle': 'Write me anything — the reply comes from your local model.',
  'offline.title': 'Ollama is not running',
  'offline.body': 'Haverom talks to a local Ollama server at {host}. Start Ollama (ollama.com), then check again.',
  'modelMissing.title': 'Model not found',
  'modelMissing.body': 'Ollama is running, but "{model}" is not pulled. Run ollama pull {model}, or pick another model in Settings.',
  'offline.retry': 'Check again',

  'input.placeholder': 'Type a message...',
  'input.send': 'Send',
  'input.stop': 'Stop',

  'card.copy': 'Copy reply',
  'card.stopped': 'Stopped',
  'thinking.label': 'Thinking',
  'stats.line': '{prompt} prompt tokens · {eval} response tokens · {tps} tok/s',
  'context.fallback': "Answered with {to} context instead of {from} — the larger size didn't fit in memory.",

  'gpu.line': 'VRAM {used} / {total} GB · GPU {util}% · {temp}°C',
  'ram.line': 'RAM {used} / {total} GB',

  'status.checking': 'Checking Ollama…',
  'status.ok': 'Ready',
  'status.modelMissing': 'Model not pulled',
  'status.offline': 'Ollama offline',
  'status.recheck': 'Check the Ollama connection again',

  'error.unreachable': "Couldn't reach Ollama ({detail}). Make sure it is running, then try again.",
  'error.timeout':
    'The model sent nothing for {detail} s, so the request was stopped. A large model can be slow to load — try again, or pick a smaller model in Settings.',
  'error.model_missing': 'The model "{detail}" is not pulled yet. Run: ollama pull {detail}',
  'error.http': 'Ollama returned an error: {detail}',
  'error.stream': 'Ollama reported an error: {detail}',
  'error.empty': 'Ollama returned an empty reply.',
  'error.invalid_host': 'The Ollama host in Settings is not a valid http(s) URL.',
  'error.memory': "Couldn't read your custom instructions ({detail}). Fix or clear them in Settings.",
  'error.bridge': 'This only works inside the Haverom desktop app.',

  'settings.title': 'Settings',
  'settings.close': 'Close',
  'settings.language': 'Language',
  'settings.alwaysOnTop': 'Always on top',
  'settings.startWithWindows': 'Start with Windows',
  'settings.autostartUnavailable': 'Only available in the packaged (installed) app.',
  'settings.largeText': 'Large text',
  'settings.highContrast': 'High contrast',
  'settings.showHardware': 'Show VRAM / RAM monitor',
  'settings.showHardwareHelp': 'Polls nvidia-smi every few seconds while the panel is open.',
  'settings.bubbleCorner': 'Bubble position',
  'settings.cornerBR': 'Bottom-right',
  'settings.cornerBL': 'Bottom-left',
  'settings.ollamaHost': 'Ollama host',
  'settings.hostInvalid': 'Enter an http:// or https:// URL.',
  'settings.ollamaModel': 'Model',
  'settings.ollamaModelHelp': 'The tag of a model pulled in Ollama — pick from the list, or type one.',
  'settings.modelInvalid': 'Enter a model tag such as qwen3:4b.',
  'settings.contextSize': 'Context size',
  'settings.contextSizeHelp': 'How much text the model can keep "in mind" at once. Larger values need more memory.',
  'settings.idleTimeout': 'Timeout (s)',
  'settings.idleTimeoutHelp':
    'Stops the reply only if the model sends NOTHING for this long; every incoming piece restarts the timer. 0 = no timeout.',
  'settings.idleTimeoutInvalid': 'Enter a whole number of seconds between 0 and 3600.',
  'settings.testConnection': 'Test connection',
  'settings.testing': 'Testing...',
  'test.ok': 'Connected — "{model}" is available.',
  'test.model_missing': 'Ollama is running, but "{model}" is not pulled. Installed: {models}.',
  'test.noModels': 'none',
  'test.unreachable': 'Not reachable: {detail}',
  'test.timeout': 'No answer from {host} within 4 seconds.',
  'test.http': 'Ollama answered with {detail}.',
  'test.invalid_host': 'The host is not a valid http(s) URL.',
  'settings.memory': 'Custom instructions',
  'settings.memoryPlaceholder': 'What the model should always keep in mind (e.g. "answer briefly", "use metric units")...',
  'settings.memoryHelp': 'Sent to the model with every message.',
  'settings.memorySave': 'Save',
  'settings.memorySaved': 'Saved',
  'settings.memoryUnsaved': 'Unsaved changes',
  'settings.memorySaveError': 'Save failed — the text was NOT written to disk.',
  'settings.memoryLoadError': "Couldn't read the saved instructions: {detail}",
  'settings.discardPrompt': 'Discard the unsaved changes to your custom instructions?',
  'settings.discard': 'Discard',
  'settings.keepEditing': 'Keep editing',
  'settings.diagnostics': 'Diagnostics',
  'settings.copy': 'Copy',
  'settings.copied': 'Copied',

  'tray.open': 'Open',
  'tray.hide': 'Hide',
  'tray.alwaysOnTop': 'Always on top',
  'tray.startWithWindows': 'Start with Windows',
  'tray.quit': 'Quit',

  'about.open': 'About Haverom',
  'about.purpose':
    'A tiny floating companion that chats with a local Ollama model: one bubble, one conversation, offline by default.',
  'about.architecture': 'Architecture',
  'about.layerMain': 'Electron main — window, tray, settings, Ollama HTTP client',
  'about.layerBridge': 'Preload bridge — narrow, validated IPC',
  'about.layerRenderer': 'React renderer — chat UI, Markdown, i18n',
  'about.builtWith': 'Built with',
  'about.repositories': 'Repositories',
  'about.repoOllama': 'local model runtime (HTTP API)',

  'transcript.title': 'Haverom — conversation',
  'transcript.user': 'User',
  'transcript.assistant': 'Haverom',

  // Prompts sent to the model: they follow the UI language, so the model answers in it.
  'prompt.system':
    "You are Haverom, a friendly, concise personal AI assistant. Always answer in English.\n\nToday's date is {date}. You run fully offline and cannot look anything up. Your training data has a cutoff, so anything that changes over time (who currently holds an office, news, prices, weather, sports results) may be outdated: say so clearly instead of presenting a guess as current fact.",
  'prompt.customInstructions': 'Custom instructions from the user — always apply them:\n\n{instructions}'
};

export type StringKey = keyof typeof en;

const hu: Record<StringKey, string> = {
  'header.pinOn': 'Rögzítés kikapcsolása (mindig felül ki)',
  'header.pinOff': 'Mindig felül',
  'header.settings': 'Beállítások',
  'header.collapse': 'Összecsukás buborékká',
  'header.halfScreen': 'Fél képernyő',
  'header.fullScreen': 'Teljes képernyő',
  'panel.newConversation': 'Új beszélgetés',
  'panel.copyConversation': 'Beszélgetés másolása',
  'panel.copied': 'Kimásolva',

  'empty.title': 'Miben segíthetek?',
  'empty.subtitle': 'Írj nekem bármit — a válasz a helyi modelltől jön.',
  'offline.title': 'Az Ollama nem fut',
  'offline.body': 'A Haverom egy helyi Ollama-szerverrel beszél ({host}). Indítsd el az Ollamát (ollama.com), majd ellenőrizd újra.',
  'modelMissing.title': 'A modell nem található',
  'modelMissing.body': 'Az Ollama fut, de a(z) „{model}” modell nincs letöltve. Futtasd: ollama pull {model}, vagy válassz másik modellt a Beállításokban.',
  'offline.retry': 'Újra ellenőrzés',

  'input.placeholder': 'Írj üzenetet...',
  'input.send': 'Küldés',
  'input.stop': 'Leállítás',

  'card.copy': 'Válasz másolása',
  'card.stopped': 'Leállítva',
  'thinking.label': 'Gondolkodás',
  'stats.line': '{prompt} prompt token · {eval} válasz token · {tps} tok/s',
  'context.fallback': '{from} helyett {to} kontextussal válaszoltam, mert a nagyobb nem fért el a memóriában.',

  'gpu.line': 'VRAM {used} / {total} GB · GPU {util}% · {temp}°C',
  'ram.line': 'RAM {used} / {total} GB',

  'status.checking': 'Ollama ellenőrzése…',
  'status.ok': 'Kész',
  'status.modelMissing': 'A modell nincs letöltve',
  'status.offline': 'Az Ollama nem érhető el',
  'status.recheck': 'Az Ollama-kapcsolat újbóli ellenőrzése',

  'error.unreachable': 'Nem sikerült elérni az Ollamát ({detail}). Ellenőrizd, hogy fut-e, majd próbáld újra.',
  'error.timeout':
    'A modell {detail} másodpercig semmit nem küldött, ezért a kérés leállt. Nagy modell betöltése lassú lehet — próbáld újra, vagy válassz kisebb modellt a Beállításokban.',
  'error.model_missing': 'A(z) „{detail}” modell még nincs letöltve. Futtasd: ollama pull {detail}',
  'error.http': 'Az Ollama hibát adott vissza: {detail}',
  'error.stream': 'Az Ollama hibát jelzett: {detail}',
  'error.empty': 'Az Ollama üres választ adott.',
  'error.invalid_host': 'A Beállításokban megadott Ollama-cím nem érvényes http(s) URL.',
  'error.memory': 'Nem sikerült beolvasni az egyéni utasításokat ({detail}). Javítsd vagy töröld őket a Beállításokban.',
  'error.bridge': 'Ez csak a Haverom asztali alkalmazásban működik.',

  'settings.title': 'Beállítások',
  'settings.close': 'Bezárás',
  'settings.language': 'Nyelv',
  'settings.alwaysOnTop': 'Mindig felül',
  'settings.startWithWindows': 'Indítás a Windowszal',
  'settings.autostartUnavailable': 'Csak a telepített (csomagolt) alkalmazásban érhető el.',
  'settings.largeText': 'Nagy betűméret',
  'settings.highContrast': 'Erős kontraszt',
  'settings.showHardware': 'VRAM / RAM figyelő',
  'settings.showHardwareHelp': 'Nyitott panelnél néhány másodpercenként lekérdezi az nvidia-smi-t.',
  'settings.bubbleCorner': 'Buborék helye',
  'settings.cornerBR': 'Jobb alsó sarok',
  'settings.cornerBL': 'Bal alsó sarok',
  'settings.ollamaHost': 'Ollama-cím',
  'settings.hostInvalid': 'Adj meg egy http:// vagy https:// címet.',
  'settings.ollamaModel': 'Modell',
  'settings.ollamaModelHelp': 'Egy Ollamában letöltött modell címkéje (tag) — válaszd a listából, vagy írd be.',
  'settings.modelInvalid': 'Adj meg egy modellcímkét, pl. qwen3:4b.',
  'settings.contextSize': 'Kontextusméret',
  'settings.contextSizeHelp': 'Mennyi szöveget tud egyszerre „észben tartani” a modell. Nagyobb érték több memóriát igényel.',
  'settings.idleTimeout': 'Időkorlát (mp)',
  'settings.idleTimeoutHelp':
    'Csak akkor állítja le a választ, ha a modell ennyi ideig SEMMIT nem küld; minden beérkező darab újraindítja a számlálót. 0 = nincs időkorlát.',
  'settings.idleTimeoutInvalid': 'Adj meg egy egész számot 0 és 3600 között.',
  'settings.testConnection': 'Kapcsolat tesztelése',
  'settings.testing': 'Tesztelés...',
  'test.ok': 'Kapcsolódva — a(z) „{model}” modell elérhető.',
  'test.model_missing': 'Az Ollama fut, de a(z) „{model}” modell nincs letöltve. Letöltött modellek: {models}.',
  'test.noModels': 'nincs',
  'test.unreachable': 'Nem érhető el: {detail}',
  'test.timeout': 'A(z) {host} 4 másodpercen belül nem válaszolt.',
  'test.http': 'Az Ollama válasza: {detail}.',
  'test.invalid_host': 'A cím nem érvényes http(s) URL.',
  'settings.memory': 'Egyéni utasítások',
  'settings.memoryPlaceholder': 'Amit a modell mindig vegyen figyelembe (pl. „válaszolj röviden”)...',
  'settings.memoryHelp': 'Minden üzenettel együtt elküldjük a modellnek.',
  'settings.memorySave': 'Mentés',
  'settings.memorySaved': 'Elmentve',
  'settings.memoryUnsaved': 'Nem mentett változás',
  'settings.memorySaveError': 'Nem sikerült menteni — a szöveg NEM került lemezre.',
  'settings.memoryLoadError': 'Nem sikerült beolvasni a mentett utasításokat: {detail}',
  'settings.discardPrompt': 'Elveted az egyéni utasítások nem mentett változásait?',
  'settings.discard': 'Elvetés',
  'settings.keepEditing': 'Szerkesztés folytatása',
  'settings.diagnostics': 'Diagnosztika',
  'settings.copy': 'Másolás',
  'settings.copied': 'Kimásolva',

  'tray.open': 'Megnyitás',
  'tray.hide': 'Elrejtés',
  'tray.alwaysOnTop': 'Mindig felül',
  'tray.startWithWindows': 'Indítás a Windowszal',
  'tray.quit': 'Kilépés',

  'about.open': 'A Haveromról',
  'about.purpose':
    'Apró, lebegő társ, amely egy helyi Ollama-modellel beszélget: egy buborék, egy beszélgetés, alapból offline.',
  'about.architecture': 'Felépítés',
  'about.layerMain': 'Electron main — ablak, tálca, beállítások, Ollama HTTP-kliens',
  'about.layerBridge': 'Preload híd — szűk, validált IPC',
  'about.layerRenderer': 'React renderer — chat-felület, Markdown, i18n',
  'about.builtWith': 'Technológia',
  'about.repositories': 'Repók',
  'about.repoOllama': 'helyi modell-futtató (HTTP API)',

  'transcript.title': 'Haverom — beszélgetés',
  'transcript.user': 'Felhasználó',
  'transcript.assistant': 'Haverom',

  'prompt.system':
    'Te vagy a Haverom, egy barátságos, tömör, segítőkész személyes AI asszisztens. Mindig magyarul válaszolj.\n\nA mai dátum: {date}. Teljesen offline futsz, nem tudsz semmit utánanézni. A betanítási adataid egy korábbi időpontig tartanak, ezért ami idővel változik (ki tölt be most egy tisztséget, hírek, árak, időjárás, sporteredmények), abban elavult lehet a tudásod: ezt mondd ki egyértelműen, ne tálalj találgatást aktuális tényként.',
  'prompt.customInstructions': 'A felhasználó egyéni utasításai — mindig vedd figyelembe őket:\n\n{instructions}'
};

export const DICTIONARIES: Record<Language, Record<StringKey, string>> = { en, hu };

export function translate(
  lang: Language,
  key: StringKey,
  vars?: Record<string, string | number>
): string {
  let s = DICTIONARIES[lang]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
