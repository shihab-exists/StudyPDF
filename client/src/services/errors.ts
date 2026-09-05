/**
 * Friendly error translation. Technical details are logged to the console
 * (client-side) but never shown to the user — no stack traces, no paths.
 */
export function friendly(e: unknown): string {
  const err = e as { name?: string; message?: string };
  const msg = err?.message ?? String(e);
  if (typeof console !== 'undefined') console.error('[StudyPDF]', e);

  if (err?.name === 'PasswordException' || /password|encrypted/i.test(msg)) {
    return 'This PDF is password protected, so StudyPDF cannot open it. Decrypt it first (e.g. open it in a PDF reader and re-save).';
  }
  if (err?.name === 'InvalidPDFException' || /invalid pdf|corrupt/i.test(msg)) {
    return 'This PDF appears to be corrupted.';
  }
  if (/missing pdf|worker/i.test(msg)) {
    return 'The PDF engine failed to start. Please refresh the page and try again.';
  }
  if (/too large|out of memory|allocation/i.test(msg)) {
    return 'This file is too large to process in your browser. Try a smaller PDF.';
  }
  if (/empty/i.test(msg)) return 'This file is empty.';
  return 'Something went wrong while processing this PDF. Please try again.';
}

export class UserError extends Error {}
