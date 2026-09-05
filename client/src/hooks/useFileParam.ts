import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFile, whenLabel } from '../services/store';
import type { FileRecord } from '../types';

/**
 * Reads ?file=<id> and loads that record from IndexedDB, so tools can be
 * opened from Home / My Files deep links. Fully local — nothing is fetched.
 */
export function useFileParam() {
  const [params] = useSearchParams();
  const fileId = params.get('file');
  const [rec, setRecState] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(!!fileId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    getFile(fileId)
      .then((f) => {
        if (!f) {
          setError('That file is no longer available — it may have been deleted or expired (files live for 24 hours).');
          return;
        }
        const { blob: _blob, ...meta } = f;
        setRecState({ ...meta, when: whenLabel(f.createdAt) });
      })
      .catch(() => setError('Could not open that file from your browser storage.'))
      .finally(() => setLoading(false));
  }, [fileId]);

  useEffect(load, [load]);

  const choose = (r: FileRecord) => {
    setRecState(r);
    setError(null);
  };

  return { rec, setRec: choose, clear: () => setRecState(null), loading, error, retry: load };
}
