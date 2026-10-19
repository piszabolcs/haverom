import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for a dialog element: focus moves into it on open and returns afterwards,
 * Tab and Shift+Tab stay inside it, and Esc asks to close.
 */
export function useDialog<T extends HTMLElement>(onRequestClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (root.querySelector<HTMLElement>(FOCUSABLE) ?? root).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
