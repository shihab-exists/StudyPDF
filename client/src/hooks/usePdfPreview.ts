import { useEffect, useMemo, useState } from 'react';
import { getBlob } from '../services/store';
import { blobBytes, firstPageSize } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';

/**
 * Collapsible, fully client-side page-preview state for single-file tools.
 * Bytes are only read from IndexedDB when the user actually opens the preview,
 * and everything resets when a different file is chosen.
 */
export function usePdfPreview(rec: FileRecord | null, onError: (msg: string) => void) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setOpen(false);
    setLoading(false);
    setBytes(null);
    setPageSize(null);
  }, [rec?.id]);

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (bytes) {
      setOpen(true);
      return;
    }
    if (!rec) return;
    setLoading(true);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const b = await blobBytes(blob);
      setBytes(b);
      firstPageSize(b).then(setPageSize).catch(() => setPageSize(null));
      setOpen(true);
    } catch (e) {
      onError(friendly(e));
    } finally {
      setLoading(false);
    }
  };

  const sources = useMemo(() => (bytes ? [bytes] : []), [bytes]);
  return { open, loading, bytes, sources, pageSize, toggle };
}
