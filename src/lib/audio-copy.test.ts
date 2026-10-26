/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindOutputCopy, copyTextareaValue, fieldForCopyButton, flashCopied } from './audio-copy';

function mountDecoder(output = '') {
  document.body.innerHTML = `
    <section data-audio-decoder>
      <p data-marks>.... --- ....</p>
      <label for="at-decode-output">Translation</label>
      <textarea id="at-decode-output" data-output="decode">${output}</textarea>
      <button type="button" data-copy="decode" data-label="Copy" data-flash="Copied" aria-label="Copy translation">
        <span data-t>Copy</span>
      </button>
    </section>
  `;
  const root = document.querySelector('[data-audio-decoder]')!;
  const field = root.querySelector<HTMLTextAreaElement>('[data-output="decode"]')!;
  const button = root.querySelector<HTMLButtonElement>('[data-copy="decode"]')!;
  return { root, field, button };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('fieldForCopyButton', () => {
  it('resolves the output by data-copy key after a DOM reorder', () => {
    const { root, field, button } = mountDecoder();
    const marks = root.querySelector('[data-marks]')!;
    root.insertBefore(field, marks);
    expect(fieldForCopyButton(root, button)).toBe(field);
  });
});

describe('copyTextareaValue', () => {
  it('calls the clipboard API with the textarea current value and flashes Copied', async () => {
    const { field, button } = mountDecoder();
    field.value = 'CQ DX';
    const writeText = vi.fn(async () => {});
    await expect(copyTextareaValue(field, button, { writeText, fallback: () => false })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('CQ DX');
    expect(button.getAttribute('data-state')).toBe('copied');
    expect(button.querySelector('[data-t]')!.textContent).toBe('Copied');
  });

  it('does not flash when both copy paths fail', async () => {
    const { field, button } = mountDecoder('SOS');
    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    await expect(copyTextareaValue(field, button, { writeText, fallback: () => false })).resolves.toBe('failed');
    expect(button.getAttribute('data-state')).toBeNull();
    expect(button.querySelector('[data-t]')!.textContent).toBe('Copy');
  });
});

describe('bindOutputCopy click', () => {
  it('click Copy copies the textarea current value', async () => {
    const { root, field, button } = mountDecoder();
    field.value = 'HELLO FROM AUDIO';
    const writeText = vi.fn(async () => {});
    bindOutputCopy(root, { writeText, fallback: () => false });
    button.click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('HELLO FROM AUDIO');
      expect(button.getAttribute('data-state')).toBe('copied');
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(button.querySelector('[data-t]')!.textContent).toBe('Copied');
  });

  it('click Copy still copies after the output is moved earlier in the DOM', async () => {
    const { root, field, button } = mountDecoder();
    field.value = 'PARIS';
    root.insertBefore(field, root.firstChild);
    const writeText = vi.fn(async () => {});
    bindOutputCopy(root, { writeText, fallback: () => false });
    button.querySelector('[data-t]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('PARIS'));
  });
});

describe('flashCopied', () => {
  it('restores the original label after the feedback window', () => {
    vi.useFakeTimers();
    const { button } = mountDecoder();
    flashCopied(button);
    expect(button.getAttribute('data-state')).toBe('copied');
    expect(button.querySelector('[data-t]')!.textContent).toBe('Copied');
    vi.advanceTimersByTime(1500);
    expect(button.getAttribute('data-state')).toBeNull();
    expect(button.querySelector('[data-t]')!.textContent).toBe('Copy');
  });
});
