import { COPY_FEEDBACK_MS, copyWithFallback } from './copy-feedback';

export type CopyDeps = {
  writeText?: ((text: string) => Promise<void>) | undefined;
  fallback?: (text: string) => boolean;
};

/** Same off-screen execCommand path the homepage translator uses. */
export function legacyCopy(value: string): boolean {
  const area = document.createElement('textarea');
  area.value = value;
  area.style.cssText = 'position:fixed;left:-9999px';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

export function flashCopied(button: HTMLButtonElement): void {
  const face = button.querySelector('[data-t]');
  const label = button.dataset.flash || 'Copied';
  const original = button.dataset.label || 'Copy';
  button.setAttribute('data-state', 'copied');
  if (face) face.textContent = label;
  window.setTimeout(() => {
    button.removeAttribute('data-state');
    if (face) face.textContent = original;
  }, COPY_FEEDBACK_MS);
}

export function fieldForCopyButton(root: ParentNode, button: HTMLButtonElement): HTMLTextAreaElement | null {
  const key = button.dataset.copy;
  if (!key) return null;
  const field = root.querySelector(`[data-output="${key}"]`);
  return field instanceof HTMLTextAreaElement ? field : null;
}

export async function copyTextareaValue(
  field: HTMLTextAreaElement,
  button: HTMLButtonElement,
  deps: CopyDeps = {},
): Promise<'copied' | 'failed'> {
  const writeText = deps.writeText ?? navigator.clipboard?.writeText?.bind(navigator.clipboard);
  const fallback = deps.fallback ?? legacyCopy;
  const result = await copyWithFallback(field.value, writeText, fallback);
  if (result === 'copied') flashCopied(button);
  return result;
}

/**
 * Event delegation so Copy still finds the output after DOM reorder.
 * Looks up `[data-output]` from the button's `data-copy` key at click time.
 */
export function bindOutputCopy(root: ParentNode, deps: CopyDeps = {}): void {
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('[data-copy]');
    if (!button || (root instanceof Node && !root.contains(button))) return;
    const field = fieldForCopyButton(root, button);
    if (!field) return;
    void copyTextareaValue(field, button, deps);
  });
}
