# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## [1.0.0] - 2026-10-19

### Added
- First public portfolio release.
- Floating bubble that opens one chat panel (compact, half screen or full work area) with a tray icon, always-on-top pin and a choice of bottom corner.
- Streaming chat with a local Ollama model, including a collapsible thinking block, token statistics, stop and an idle timeout.
- Ollama status in the footer (ready, model not pulled, unreachable), an empty state with *Check again* and a *Test connection* button.
- Model picker from the pulled models, context size setting and automatic retry with a smaller context when memory runs out.
- Custom instructions stored in `memory.md`, one conversation kept across restarts, copy as Markdown.
- English and Hungarian UI, large text, high contrast and an optional NVIDIA VRAM/RAM monitor.
- Sandboxed renderer with a strict Content-Security-Policy and validated IPC; images in replies are shown as links only.
- Vitest unit tests and an off-screen Playwright end-to-end test against a fake Ollama server.
