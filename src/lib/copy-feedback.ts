export const COPY_FEEDBACK_MS = 1500;

export type CopyFlash = {
  label: string;
  until: number;
};

export function beginFlash(label: string, now: number, duration = COPY_FEEDBACK_MS): CopyFlash {
  return { label, until: now + duration };
}

export function visibleLabel(original: string, flash: CopyFlash | null, now: number): string {
  if (!flash || now >= flash.until) return original;
  return flash.label;
}

export async function copyWithFallback(
  value: string,
  writeText: ((text: string) => Promise<void>) | undefined,
  legacyCopy: (text: string) => boolean,
): Promise<'copied' | 'failed'> {
  if (writeText) {
    try {
      await writeText(value);
      return 'copied';
    } catch {
      // The async clipboard can reject on insecure origins. Try the legacy path.
    }
  }
  try {
    if (legacyCopy(value)) return 'copied';
  } catch {
    // execCommand can throw when the document is not focused.
  }
  return 'failed';
}
