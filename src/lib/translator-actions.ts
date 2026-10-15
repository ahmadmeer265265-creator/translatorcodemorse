import { buildTxtFile, txtExportNotice } from './translator-core';

export function downloadTxt(morse: string): { notice: string } {
  const file = buildTxtFile(morse);
  const blob = new Blob([file.body], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { notice: file.notice };
}

export async function shareOrCopy(
  url: string,
  copy: (value: string) => Promise<'copied' | 'failed'>,
): Promise<'shared' | 'copied' | 'failed'> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share === 'function') {
    try {
      const data: ShareData = { url, title: document.title };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return 'shared';
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
    }
  }
  return copy(url);
}

export { txtExportNotice };
